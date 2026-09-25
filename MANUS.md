# MANUS.md - Yolnoma

## 1. Getting Started

Before starting any new task:

1. Study the project's overall structure.
2. Inspect the relevant files, components, modules, and functions.
3. Understand the existing architecture and coding style.
4. Search for existing implementations related to the task.
5. Try to determine how the changes may affect other parts of the project.
6. Create an implementation plan and present it to the developer.
7. Do not start modifying code until the developer approves the plan.

If the task is unclear or important requirements are missing, ask questions instead of making assumptions.

Plan approval is required for both simple and complex tasks.

## 2. Coding and Architecture

### 2.1. DRY — Don't Repeat Yourself

Do not unnecessarily write the same code multiple times.

- Check whether an existing function, component, helper, or module can be reused.
- Do not duplicate the same business logic in multiple places.
- Before consolidating duplicated code, verify that it genuinely serves a common purpose.
- Do not create complex abstractions merely to reduce the number of lines of code.

### 3.2. Inspecting Existing Code

Before creating a new component, function, module, or other resource:

- Check whether a similar implementation already exists in the project.
- Evaluate whether existing code can be extended or reused.
- Avoid creating a new component or module that performs the same task as an existing one.
- If an existing solution meets the requirements, use it.

### 3.3. Minimal Changes

Modify only the code necessary to complete the task.

- Do not modify files unrelated to the task.
- Do not rewrite existing working functionality without a valid reason.
- Do not add unnecessary dependencies.
- Do not arbitrarily change the existing project architecture unless the user explicitly grants permission.

### 3.4. Refactoring

Do not perform refactoring without the developer's explicit permission.

If refactoring is necessary:

1. Explain why it is needed.
2. Identify which files and sections will be changed.
3. Explain the expected benefits and risks.
4. Obtain permission from the developer.

Do not perform refactoring that is unnecessary for completing the task.

## 4. Git and Commit Rules

### 4.1. General Rules

Consider the current repository state when working with Git.

- Check the current branch and working tree status before starting work.
- Review changes before committing.
- Create one commit for each task.

Do not create multiple small commits while completing a single task. After completing the final checks, combine all relevant changes into one logical commit.

### 4.2. Conventional Commits

All commit messages must comply with the Conventional Commits format.

The standard format is:

`<type>(<scope>): <description>`

Examples:

- `feat(auth): add refresh token support`
- `fix(api): handle invalid request body`
- `docs(readme): update installation instructions`
- `refactor(users): simplify user mapping`
- `test(auth): add login validation tests`
- `chore(deps): update dependencies`

Rules:

- Commit messages must be written in English.
- The description must be concise, clear, and meaningful.
- The commit type must accurately reflect the purpose of the change.
- Do not use unnecessary or meaningless commit messages.
- Follow the existing Commitlint configuration in the project.
- Before committing, verify that the commit message complies with Commitlint requirements.

If the project has a Commitlint configuration, do not modify its rules.

### 4.3. One Task — One Commit

Combine all relevant changes into a single commit at the end of the task.

Only changes related to the current task may be included in the commit.

If the working tree contains other changes made by the developer, preserve them and do not include them in the commit.

If the changes cannot be safely separated, ask the developer for clarification.

## 5. Main Branch Safety

`master` is the main branch.

### 5.1. Working on the Main Branch

If the developer directly assigns a task:

1. Analyze the task.
2. Create an implementation plan.
3. Obtain the developer's approval for the plan.
4. Complete the task according to the approved plan.
5. Run typecheck and build checks.
6. Review the changes.
7. If the current branch is the main branch, obtain separate approval from the developer before committing.

The developer assigning a task does not automatically grant permission to commit to the main branch.

### 5.2. Committing to the Main Branch

Before committing to the main branch:

- Check the current branch.
- Show the list of changes.
- Report the typecheck and build results.
- Show the proposed commit message.
- Obtain explicit approval from the developer.

Do not commit to the main branch until approval has been obtained.

### 5.3. Pushing

Never execute `git push` unless the developer explicitly grants permission.

This rule applies only to the main `master` branch.

Permission to complete a task, create a commit, or perform other Git operations does not constitute permission to push.

A separate and explicit instruction from the developer is required before pushing.

## 6. Protecting Git History

Be extremely careful when performing operations that modify Git history.

The following operations must not be performed without the developer's explicit permission:

- `git reset`
- `git rebase`
- `git commit --amend`
- `git cherry-pick`
- `git revert`
- Rewriting history created through `git commit`
- Deleting commits or changing their order
- Removing individual changes from a commit
- Forcefully switching or restoring branches
- `git push --force` and `git push --force-with-lease`
- Any other operation that may cause the loss of Git history or working tree changes

If such an operation is necessary to complete the task:

1. Explain why it is necessary.
2. Check the current Git state.
3. Try to identify the affected commits and changes.
4. Explain the risks.
5. Determine what negative consequences the operation could cause, if any.
6. Obtain separate permission from the developer.

Never delete or overwrite the developer's existing changes without permission.

## 7. Verification and Quality Control

Run the following checks at the end of every task:

### 7.1. Typecheck

Run the existing typecheck command in the project.

If TypeScript or another type system is used, run the relevant checks.

### 7.2. Verification Results

If typecheck or build fails:

- Analyze the error.
- If it can be fixed within the scope of the task, fix it.
- Run the check again.
- If the issue remains unresolved, clearly report it.

If a required command does not exist, do not create one arbitrarily. Report this in the final report.

Do not claim that changes are successful if they have not passed the required checks.

## 8. Dependency and Configuration Safety

Without the developer's explicit permission:

- Do not add new dependencies.
- Do not change existing dependency versions.
- Do not update or remove dependencies.
- Do not unnecessarily regenerate lockfiles.
- Do not modify environment variables or secret keys.
- Do not modify production configuration.

If such a change is necessary for the task, explain the reason and impact first, then obtain permission.

Never commit secret keys, tokens, or passwords.

## 9. Task Completion

Provide a detailed report at the end of every task.

The report must include:

1. **Task:** What was completed.
2. **Changes:** Which files and sections were modified.
3. **Technical Solution:** What approach was used and why.
4. **Checks:** Typecheck and build results.
5. **Git Status:** Branch, commit status, and commit hash, if a commit was created.
6. **Issues:** Any unresolved errors or limitations.
7. **Next Steps:** Any actions the developer needs to take, if applicable.

Do not claim that incomplete work has been completed.

Do not claim that a commit has been pushed to the remote repository if it has not been pushed.

## 10. General Principles

- Follow the developer's instructions.
- Do not start coding without an approved plan.
- Do not create a new implementation without examining the existing code.
- Follow the DRY principle.
- Avoid unnecessary complexity.
- Do not refactor without permission.
- Protect Git history.
- Obtain approval before committing to the main branch.
- Never push without the developer's explicit permission.
- Complete each task with one commit.
- Run typecheck and build checks.
- Provide a detailed report at the end of every task.
- If something is unclear, ask questions instead of making assumptions.

**Main Rule:** Perform the work necessary to complete the task, but never independently perform operations that require the developer's supervision and permission.

> Dear MANUS AI agent, thank you for joining this journey and for your contribution, my friend. Yolnoma loves you. ❤️

---

**Context version:** 0.1

**Updated:** 2026-09-25
**by Yolnoma**
