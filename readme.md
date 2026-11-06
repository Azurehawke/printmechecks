![PMV](https://drx-danwins.us-east-1.linodeobjects.com/drx-danwins/pmc_51525a39.png) 

# What is this?
Print Me Checks is an open source check printing tool that runs on the web. 

# Goal
The purpose of this project is to provide a free, locally run alternative to check printing tools that exist on the internet. Some of these tools charge $1.25 or more to print a check and you must provide your banking details to a third party. This is silly! This project was literally completed in one day and gets the same job done. 

I buy blank check stock from (insert store here) and then use this tool to print checks for all my businesses with
multiple bank accounts. Works like a charm!

## Screenshot
![PMV](https://drx-danwins.us-east-1.linodeobjects.com/drx-danwins/screencapture-printmechecks-tiiny-site-2024-07-04-07_13_31_(1)_e9e4be02.png)

Simple Vue App for printing checks on 8.5x11 paper.

## Features
* Printing from the Browser
* Fancy signature font (optional)
* Routing and Account number uses official E13B Font
* Run locally to avoid sharing your account number over the internet
* Automatically converts amount of money to english words


# Demo
If you don't want to run the project locally, you can try out the demo version for free. Hosting is not guaranteed to be
up and running in the future though, but I'll keep it up as long as I can. 

[Demo](https://printmechecks.tiiny.site/)

## Requirements
***Must Have Node installed***

## Usage

Clone the repository

```sh
git clone https://github.com/sktzofrenic/printmechecks.git
```
Enter the project directory

```sh
cd printmechecks
```
Install JS dependencies

```sh
npm install
```

## Using the app

* **Ribbon** (top): **Home** (print, save PDF, new check, save to register),
  **Text** (one font and size for the whole check), **Layout** (move fields,
  shift the whole check to line up with your printer), **Accounts** (saved bank
  accounts), **Register** (saved checks, search, CSV export).
* **Tools** (left): select/move fields, pan, zoom, field outlines, background.
* **Check details** (right): account, check number, date, payee, amount, memo.
* **Accounts:** enter each bank account once; it's remembered, along with its
  next check number. Switch accounts from the dropdown.
* **Check numbers** can use any format, e.g. `100` or `100-0001`. After you save
  a check to the register, the last group of digits counts up and keeps its
  leading zeros (`100-0001` → `100-0002`). On the MICR line a dash prints as the
  MICR dash symbol.
* **Moving fields:** with the select tool, click a field and use the arrow keys
  (Shift for 10×). **Layout → Shift Whole Check** moves everything at once to
  match your printer's feed.
* The signature line is left blank for signing by hand.

## Windows desktop app

Print Me Checks can run as a regular Windows 11 app. It runs fully offline:
fonts and styles are bundled, so nothing loads from the internet and your
account numbers stay on your machine.

Download from the latest build, or build it yourself on Windows:

```sh
cd printmechecks
npm install
npm run dist:win
```

This creates two files in `printmechecks/release/`:

* `PrintMeChecks-Setup-<version>.exe`: installer with Start menu and desktop shortcuts
* `PrintMeChecks-<version>-portable.exe`: a single exe that runs without installing

To try the desktop app without packaging it, run `npm run app`.

The builds are not code-signed, so Windows SmartScreen may warn on first
launch. Click **More info → Run anyway**.

**Print** (or Ctrl+P) opens a print preview showing exactly what will print.
From there, **Print…** opens the Windows print dialog and **Save as PDF…**
saves the check as a PDF directly. In the Windows dialog, keep the paper at
Letter and the scale at 100%.

### Updates

On startup the app checks this repository's
[GitHub Releases](https://github.com/Azurehawke/printmechecks/releases) for a
newer version. If it finds one, it asks whether to download it:

* **Installed copy:** the update downloads, the app closes, and the update
  installs in the background. The app stays closed until you start it again.
* **Portable copy:** the new portable exe is saved in the same folder as the
  current one, the folder opens, and the app closes. Start the new file. You
  can delete the old one afterwards.

Saved checks (History) are kept across updates. If you're offline, the check
is skipped silently. **Help → Releases on GitHub** opens the releases page.

### Publishing a new version

1. Bump `"version"` in `printmechecks/package.json` (e.g. `1.0.2`).
2. Commit and push to `master`.

The GitHub Actions workflow (`.github/workflows/build-windows.yml`) sees a
version with no release yet, builds both exes on Windows, and publishes
release `v<version>` (it creates the tag) with `latest.yml`, which is what the
installed app checks. Pushes that don't bump the version only build. You can
also run the workflow manually from the Actions tab to build without
publishing.
