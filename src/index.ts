#!/usr/bin/env node --experimental-specifier-resolution=node

import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import { input, select, password } from "@inquirer/prompts";
import ora from "ora";
import bitbucket, { Schema } from "bitbucket";
import { Options } from "bitbucket/src/client/types";
import { PackageJson } from "types-package-json";

import { AuthTypes, HTTPError } from "./types";
import {
  validateValue,
  validateDependency,
  validateSlug,
  validateVersion,
  validateWorkspace,
  updateDependencyVersion,
} from "./validation";
import { createFileCommit, createPullRequest, getAllBranches, getBranchFile } from "./bitbucket";
import semver from "semver/preload";

const { Bitbucket } = bitbucket;

const program = new Command("bitbucket-auto-pr");

program.description("CLI to update the dependencies and create the bitbucket pull request").version("0.1.0");

program
  .command("make-pr")
  .description("Updates the dependency and create the bitbucket pull request")
  .option("-w, --workspace <workspace>", "Bitbucket workspace")
  .option("-s, --slug <slug>", "Bitbucket slag of the repository")
  .option("-d, --dependency <dependency>", "Dependency to update")
  .option("-v, --version <version>", "Dependency version to update")
  .action(async options => {
    console.log(
      "\n" +
        boxen(chalk.green("CLI to update the dependencies and create the bitbucket pull request"), {
          title: "BITBUCKET-AUTO-PR",
          titleAlignment: "center",
          textAlignment: "center",
          padding: 1,
          borderColor: "green",
        }),
    );

    const clientOptions: Options = {
      baseUrl: "https://api.bitbucket.org/2.0",
    };

    const authType = await select({
      message: "Choose Bitbucket authentication type",
      choices: [
        { value: AuthTypes.TOKEN, name: "Token" },
        { value: AuthTypes.BASIC, name: "Username/Password" },
      ],
    });
    options.authType = authType;

    if (options.authType === AuthTypes.TOKEN) {
      clientOptions.auth = {
        token: await input({ message: "Enter your Bitbucket token:", validate: validateValue }),
      };
    }
    if (options.authType === AuthTypes.BASIC) {
      clientOptions.auth = {
        username: await input({ message: "Enter your Bitbucket username:", validate: validateValue }),
        password: await password({ message: "Enter your Bitbucket password:", validate: validateValue }),
      };
    }

    const bitbucketClient = new Bitbucket(clientOptions);

    if (!options.workspace) {
      options.workspace = await input({
        message: "Enter your Bitbucket workspace:",
        validate: async value => await validateWorkspace(value, bitbucketClient),
      });
    } else {
      const res = await validateWorkspace(options.workspace, bitbucketClient);
      if (typeof res === "string") {
        program.error(chalk.red(res));
      }
    }

    if (!options.slug) {
      options.slug = await input({
        message: "Enter your Bitbucket slag of the repository:",
        validate: async value => await validateSlug(options.workspace, value, bitbucketClient),
      });
    } else {
      const res = await validateSlug(options.workspace, options.slug, bitbucketClient);
      if (typeof res === "string") {
        program.error(chalk.red(res));
      }
    }

    let branchesList: Schema.Branch[] = [];
    const getBranchesSpinner = ora({ text: "Searching for available branches", spinner: "dots" }).start();
    try {
      const values = await getAllBranches(options.workspace, options.slug, bitbucketClient);
      if (values) branchesList = values;
    } catch (error) {
      program.error("\n" + chalk.red((error as HTTPError).error.error.message));
    } finally {
      getBranchesSpinner.stop();
    }

    if (branchesList.length) {
      options.branch = await select({
        message: "Pick the branch from the list:",
        choices: branchesList.map(branch => ({ value: branch, name: branch.name })),
      });
    } else {
      program.error(chalk.red("You repository doesn't have branches"));
    }

    let file: Partial<PackageJson>;
    const getBranchFileSpinner = ora({ text: "Getting the package.json file", spinner: "dots" }).start();
    try {
      file = await getBranchFile(
        options.workspace,
        options.slug,
        options.branch.target.hash ?? "",
        "package.json",
        bitbucketClient,
      );
    } catch (error) {
      program.error("\n" + chalk.red((error as HTTPError).error.error.message));
    } finally {
      getBranchFileSpinner.stop();
    }

    if (!options.dependency) {
      options.dependency = await input({
        message: "Enter the dependency to update:",
        validate: value => validateDependency(value, file),
      });
    } else {
      const res = validateDependency(options.dependency, file!);
      if (typeof res === "string") {
        program.error(chalk.red(res));
      }
    }

    if (!options.version) {
      const ver = await input({
        message: "Enter the version of the dependency:",
        validate: value => validateVersion(value, options.dependency, file),
      });
      options.version = semver.coerce(ver)?.version;
    } else {
      const res = validateVersion(options.version, options.dependency, file!);
      if (typeof res === "string") {
        program.error(chalk.red(res));
      }
      options.version = semver.coerce(options.version)?.version;
    }

    const newPackageJson = updateDependencyVersion(file!, options.dependency, options.version);
    const newBranch = `patch/${options.dependency}-${options.version}`;
    const title = `Update ${options.dependency} to ${options.version}`;
    const description = `This is automatically-generated PR to update ${options.dependency} to ${options.version}`;

    const prSpinner = ora({ text: "committing the changes...", spinner: "dots" }).start();
    try {
      await createFileCommit(
        options.workspace,
        options.slug,
        newBranch,
        options.branch.name,
        "package.json",
        JSON.stringify(newPackageJson, null, 2),
        title,
        bitbucketClient,
      );

      prSpinner.text = "Creating pull request...";
      const prUrl = await createPullRequest(
        options.workspace,
        options.slug,
        newBranch,
        options.branch.name,
        title,
        description,
        bitbucketClient,
      );

      console.log("\n" + prUrl);
    } catch (error) {
      program.error("\n" + chalk.red((error as HTTPError).error.error.message));
    } finally {
      prSpinner.stop();
    }
  });

program.parse();
