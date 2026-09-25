# 🛠️ Build Commands

This guide explains how to build and publish the **SteamUtility** project using the .NET SDK.

---

## 📋 Prerequisites

Before starting, make sure you have the following installed:

- **.NET SDK 8.0 or later**
- **Windows operating system**
- Access to the project source code
- A terminal such as:
  - PowerShell
  - Command Prompt
  - Windows Terminal

---

## 📥 Install the .NET SDK

Download and install the latest version of the .NET SDK from the official Microsoft website:

🔗 [Download .NET SDK](https://dotnet.microsoft.com/en-us/download/visual-studio-sdks)

> **Note:** Make sure to install the **SDK**, not only the .NET Runtime.

You can verify the installed version by running:

```powershell
dotnet --version
```

The installed version must be **8.0 or later**.

---

## 📁 Navigate to the SteamUtility Project

Open a terminal and navigate to the `SteamUtility` project directory:

```powershell
cd Yolnoma-App\libs\SteamUtility
```

To verify that you are in the correct directory, list the files:

```powershell
dir
```

You should see the project files, including the `.csproj` file.

---

## 🚀 Publish the SteamUtility Project

Run the following command to build and publish the project in **Release** mode:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true
```

### Command Options

| Option                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `publish`               | Builds and prepares the application for deployment |
| `-c Release`            | Uses the Release configuration                     |
| `-r win-x64`            | Targets 64-bit Windows systems                     |
| `--self-contained true` | Includes the .NET runtime with the application     |

Because the build is self-contained, users do not need to install the .NET Runtime separately.

---

## 📂 Build Output

After the publishing process is completed successfully, the generated files will be available in:

```text
bin\Release\
```

The final publish directory is usually located at:

```text
bin\Release\net8.0\win-x64\publish\
```

> The exact framework folder may vary depending on the target framework configured in the project file.

---

## ✅ Verify the Build

To check the published files, run:

```powershell
dir bin\Release\net8.0\win-x64\publish\
```

You can also open the output folder manually:

```powershell
explorer bin\Release\net8.0\win-x64\publish\
```

---

## 🧹 Optional: Clean Previous Build Files

If you want to remove previous build results before publishing again, run:

```powershell
dotnet clean
```

You can then publish the project again:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true
```

---

## 📝 Complete Command Summary

```powershell
cd Yolnoma-App\libs\SteamUtility

dotnet --version

dotnet clean

dotnet publish -c Release -r win-x64 --self-contained true

explorer bin\Release\net8.0\win-x64\publish\
```

---

## 🎯 Result

The published, ready-to-distribute application files will be located in:

```text
Yolnoma-App\libs\SteamUtility\bin\Release\net8.0\win-x64\publish\
```
