import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const defaultHost = "112.124.69.114";
const defaultUser = "root";
const defaultRoot = "/www/wwwroot";

const args = new Set(process.argv.slice(2));
const skipRelease = args.has("--skip-release");
const dryRun = args.has("--dry-run");

const host = process.env.DEPLOY_HOST ?? defaultHost;
const user = process.env.DEPLOY_USER ?? defaultUser;
const deployRoot = process.env.DEPLOY_ROOT ?? defaultRoot;
const identityFile = process.env.DEPLOY_IDENTITY_FILE;
const sshPort = process.env.DEPLOY_PORT;
const explicitArchive = process.env.DEPLOY_ARCHIVE;

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`\n$ ${printable}`);

  if (dryRun) {
    return;
  }

  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? projectRoot,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getLatestReleaseArchive() {
  if (explicitArchive) {
    const archive = resolve(projectRoot, explicitArchive);
    if (!existsSync(archive)) {
      throw new Error(`DEPLOY_ARCHIVE does not exist: ${archive}`);
    }

    return archive;
  }

  const releasesRoot = resolve(projectRoot, "dist", "releases");
  if (!existsSync(releasesRoot)) {
    throw new Error("No release directory found. Run npm run release first.");
  }

  const archives = readdirSync(releasesRoot)
    .filter((name) => name.endsWith(".tar.gz") || name.endsWith(".zip"))
    .map((name) => {
      const path = resolve(releasesRoot, name);
      return { path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (archives.length === 0) {
    throw new Error("No release archive found. Run npm run release first.");
  }

  return archives[0].path;
}

function sshBaseArgs() {
  const base = [];

  if (identityFile) {
    base.push("-i", identityFile);
  }

  if (sshPort) {
    base.push("-p", sshPort);
  }

  return base;
}

function scpBaseArgs() {
  const base = [];

  if (identityFile) {
    base.push("-i", identityFile);
  }

  if (sshPort) {
    base.push("-P", sshPort);
  }

  return base;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

if (!skipRelease) {
  run("npm", ["run", "release"]);
}

const archivePath = getLatestReleaseArchive();
const archiveName = basename(archivePath);
const packageName = archiveName.replace(/\.tar\.gz$|\.zip$/u, "");
const remoteArchive = `${deployRoot}/${archiveName}`;
const remotePackageRoot = `${deployRoot}/${packageName}`;
const remote = `${user}@${host}`;

console.log("");
console.log(`Deploy target: ${remote}:${remotePackageRoot}`);
console.log(`Archive: ${archivePath}`);

run("ssh", [...sshBaseArgs(), remote, `mkdir -p ${shellQuote(deployRoot)}`]);
run("scp", [...scpBaseArgs(), archivePath, `${remote}:${remoteArchive}`]);

const extractCommand = archiveName.endsWith(".tar.gz")
  ? `tar -xzf ${shellQuote(remoteArchive)} -C ${shellQuote(deployRoot)}`
  : `unzip -q -o ${shellQuote(remoteArchive)} -d ${shellQuote(deployRoot)}`;

const remoteCommand = [
  `set -e`,
  extractCommand,
  `rm -f ${shellQuote(remoteArchive)}`,
  `cd ${shellQuote(remotePackageRoot)}`,
  `npm run prepare:bt`,
  `echo`,
  `echo "Deployment prepared at ${remotePackageRoot}"`,
  `echo "Start command remains: npm run start:bt"`,
].join(" && ");

run("ssh", [...sshBaseArgs(), remote, remoteCommand]);
