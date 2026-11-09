# Security

## How Twins handles your code

* Twins only imports **public** GitHub repos. The Twins server downloads the source archive and reads it as text. It never runs your code.
* Anything that runs code (installing packages, the type check, the build) happens on a separate Vercel Sandbox created for that repo.
  * Packages are installed with install scripts turned off.
  * The sandbox is cut off from the network before the build runs, since a build runs scripts from the repo.
  * Sandboxes are created with persistence off and stop on a timeout, so nothing is kept after they stop.
* A merge is written to the repo copy on the sandbox only. Your GitHub repo changes only when you choose "Send to my repo", which opens a pull request on your repo or on your fork. Twins never pushes to a default branch.
* GitHub access is requested through OAuth only when you open a pull request, and only for that.
* Each user can import a limited number of repos per day.

## Agents

Connected agents (Claude Code, Codex, Cursor and other MCP apps) sign in with OAuth and act as you. They call the same actions as the page, so every merge they make goes through the same test, and they can only see your own maps.

## Reporting a problem

Please report security issues privately to jennifereze12@gmail.com rather than opening a public issue. You will get a reply within a few days.
