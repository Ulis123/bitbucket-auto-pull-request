import { APIClient } from "bitbucket";
import semver from "semver/preload";
import { PackageJson, PackageJsonDependencyTypes } from "types-package-json";
import { spawnSync } from "node:child_process";

const dependenciesKeysMap: PackageJsonDependencyTypes[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const getDependencyVersion = (file: Partial<PackageJson>, dependency: string) => {
  for (const dep of dependenciesKeysMap) {
    if (file[dep]?.[dependency]) {
      return file[dep]?.[dependency];
    }
  }
};

export const updateDependencyVersion = (file: Partial<PackageJson>, dependency: string, version: string) => {
  const newFile = structuredClone(file);
  for (const dep of dependenciesKeysMap) {
    if (newFile[dep]?.[dependency]) {
      newFile[dep]![dependency] = "^" + version;
      break;
    }
  }
  return newFile;
};

export const validateValue = (value: string) => !!value;

export const validateWorkspace = async (workspace: string, bitbucketClient: APIClient) => {
  try {
    const devBranch = await bitbucketClient.workspaces.getWorkspace({ workspace });
    return !!devBranch;
  } catch (error) {
    return `The workspace ${workspace} doesn't exist in your Bitbucket account.`;
  }
};

export const validateSlug = async (workspace: string, repo_slug: string, bitbucketClient: APIClient) => {
  try {
    const devBranch = await bitbucketClient.repositories.get({ workspace, repo_slug });
    return !!devBranch;
  } catch (error) {
    return `The slug ${repo_slug} doesn't exist in your Bitbucket account.`;
  }
};

export const validateDependency = (dependency: string, file: Partial<PackageJson>) => {
  const value = getDependencyVersion(file, dependency);
  if (!value) return `The dependency ${dependency} doesn't exist.`;
  return !!value;
};

export const validateVersion = (version: string, dependency: string, file: Partial<PackageJson>) => {
  const newVersion = semver.coerce(version);
  if (!semver.valid(newVersion)) return `The version ${version} is not valid.`;

  const latestVersionRow = spawnSync("npm", ["view", dependency, "version"]);
  const latestVersion = semver.coerce(latestVersionRow.stdout.toString());
  const prevVersion = semver.coerce(getDependencyVersion(file, dependency));

  if (semver.lte(newVersion!.version, prevVersion!.version)) {
    return `The version ${version} is lower or equal the previous version.`;
  }

  if (!semver.satisfies(newVersion!.version, `${prevVersion?.version} - ${latestVersion?.version}`)) {
    return `The version ${version} is not correct`;
  }

  return !!version;
};
