# ATLAS Windows Launcher

The ATLAS launcher provides a portable startup path for a normal GitHub clone on Windows. It uses paths relative to the repository and does not require administrator privileges or Chocolatey.

## Start ATLAS

1. Install a supported Node.js release from <https://nodejs.org/> (Node.js 20.19+ or 22.12+).
2. Clone the repository and select the intended ATLAS branch.
3. Double-click `launch-atlas.bat`.

The batch file delegates to `launch-atlas.ps1`, which:

1. Locates `node.exe` and `npm.cmd` through the current Windows `PATH`.
2. Verifies `package.json` and `package-lock.json` are present.
3. Runs `npm.cmd ci` when the locked dependencies are not installed.
4. Runs the complete test suite before starting the server.
5. Checks whether port 5173 is available, already serves ATLAS, or belongs to another application.
6. Starts Vite in the background and waits up to 45 seconds for an ATLAS-specific readiness response.
7. Opens `http://127.0.0.1:5173/` in the default browser only after readiness succeeds.

An already-running ATLAS instance is reused instead of starting a duplicate. If another application owns port 5173, the launcher stops with an explanatory error.

## PowerShell usage

Run the PowerShell launcher directly when preferred:

```powershell
.\launch-atlas.ps1
```

For automated verification without opening a browser:

```powershell
.\launch-atlas.ps1 -SkipBrowser
```

The launcher uses a process-local execution-policy override only when invoked through the batch wrapper. It does not change the machine's configured PowerShell policy.

## Diagnostics

Startup output is written outside the repository to:

- `%TEMP%\atlas-vite-output.log`
- `%TEMP%\atlas-vite-error.log`

If startup fails, the launcher prints available error details and exits with a nonzero status. Test failures prevent the server from starting.

## Updating a clone

After switching to or updating the intended branch, rerun the launcher. If dependencies changed, remove and reinstall them deliberately with `npm.cmd ci`; do not copy `node_modules` between computers.
