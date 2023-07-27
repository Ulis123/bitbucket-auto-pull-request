import { APIClient } from "bitbucket";

export const getAllBranches = async (workspace: string, repo_slug: string, client: APIClient) => {
  try {
    const { data } = await client.repositories.listBranches({ workspace, repo_slug });
    return data.values;
  } catch (e) {
    throw e;
  }
};

export const getBranchFile = async (
  workspace: string,
  repo_slug: string,
  commit: string,
  filePath: string,
  client: APIClient,
) => {
  try {
    const { data } = await client.source.read({
      commit,
      workspace,
      repo_slug,
      path: filePath,
    });
    return JSON.parse(data as string);
  } catch (e) {
    throw e;
  }
};

export const createPatchBranch = async (
  workspace: string,
  repo_slug: string,
  branchName: string,
  fromBranch: string,
  client: APIClient,
) => {
  try {
    const { data } = await client.repositories.createBranch({
      workspace,
      repo_slug,
      _body: {
        name: branchName,
        target: {
          hash: fromBranch,
        },
      },
    });
    return data;
  } catch (e) {
    throw e;
  }
};

export const createFileCommit = async (
  workspace: string,
  repo_slug: string,
  branchName: string,
  fromBranch: string,
  filePath: string,
  fileContent: string,
  commitMessage: string,
  client: APIClient,
) => {
  try {
    await client.repositories.createSrcFileCommit({
      workspace,
      repo_slug,
      _body: {
        branch: branchName,
        parents: fromBranch,
        message: commitMessage,
        [filePath]: fileContent,
      },
    });
  } catch (e) {
    throw e;
  }
};

export const createPullRequest = async (
  workspace: string,
  repo_slug: string,
  fromBranch: string,
  targetBranch: string,
  title: string,
  description: string,
  client: APIClient,
) => {
  const { data } = await client.pullrequests.create({
    repo_slug,
    workspace,
    _body: {
      type: "pullrequest",
      title: title,
      description,
      close_source_branch: true,
      source: {
        branch: {
          name: fromBranch,
        },
      },
      destination: {
        branch: {
          name: targetBranch,
        },
      },
    },
  });

  return data.links!.html!.href!;
};
