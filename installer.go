package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// installSkill copies one skill folder from the embedded filesystem into
// targetDir/<slug>/. Returns one of three results via (installed, skipped,
// err):
//
//	installed=true,  skipped=false  copied successfully
//	installed=false, skipped=true   user declined overwrite
//	installed=false, skipped=false  dry-run (no action)
//	installed=false, skipped=false, err != nil  failure
//
// Prompt logic: if the destination already exists AND force==false,
// we ask the user whether to overwrite. force=true (flag: --force)
// overwrites without prompting. dryRun prints the intended actions
// and never writes.
func installSkill(
	embedDept, slug, targetDir string,
	force, dryRun bool,
	stdin io.Reader,
	stdout io.Writer,
) (installed bool, skipped bool, err error) {
	srcDir := skillDirPath(embedDept, slug)
	destDir := filepath.Join(targetDir, slug)

	// Check if destination exists.
	_, statErr := os.Stat(destDir)
	destExists := statErr == nil

	if destExists && !force {
		overwrite, err := promptYesNo(
			fmt.Sprintf("    skill %q already exists at %s. Overwrite?", slug, destDir),
			stdin, stdout,
		)
		if err != nil {
			return false, false, err
		}
		if !overwrite {
			fmt.Fprintf(stdout, "    %s skipped\n", slug)
			return false, true, nil
		}
	}

	if dryRun {
		if destExists {
			fmt.Fprintf(stdout, "    [dry-run] would overwrite %s\n", slug)
		} else {
			fmt.Fprintf(stdout, "    [dry-run] would install %s\n", slug)
		}
		return false, false, nil
	}

	// Remove the destination (if exists) so a stale file in the old
	// version doesn't linger when the new version removes that file.
	if destExists {
		if err := os.RemoveAll(destDir); err != nil {
			return false, false, fmt.Errorf("remove old %s: %w", destDir, err)
		}
	}
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return false, false, fmt.Errorf("mkdir %s: %w", destDir, err)
	}
	if err := copyEmbedTree(srcDir, destDir); err != nil {
		return false, false, fmt.Errorf("copy %s: %w", slug, err)
	}
	fmt.Fprintf(stdout, "    ✓ installed %s\n", slug)
	return true, false, nil
}

// removeInstalledSkill deletes a skill's folder from targetDir. No prompt;
// the caller gates with dry-run / confirm as appropriate.
func removeInstalledSkill(slug, targetDir string, dryRun bool, stdout io.Writer) (bool, error) {
	destDir := filepath.Join(targetDir, slug)
	_, err := os.Stat(destDir)
	if errors.Is(err, os.ErrNotExist) {
		fmt.Fprintf(stdout, "    %s is not installed at %s\n", slug, targetDir)
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("stat %s: %w", destDir, err)
	}
	if dryRun {
		fmt.Fprintf(stdout, "    [dry-run] would remove %s\n", slug)
		return false, nil
	}
	if err := os.RemoveAll(destDir); err != nil {
		return false, fmt.Errorf("remove %s: %w", destDir, err)
	}
	fmt.Fprintf(stdout, "    ✗ removed %s\n", slug)
	return true, nil
}

// copyEmbedTree walks srcDir inside embeddedDepartments and recreates
// it verbatim at destDir on the real filesystem. Directories get 0755.
// Files get 0644, except known executable script extensions (.sh, .py)
// which get 0755 — Go's embed strips the executable bit, so we restore
// it here so users can invoke helper scripts directly without a manual
// chmod step.
func copyEmbedTree(embedDir, destDir string) error {
	return fs.WalkDir(embeddedDepartments, embedDir, func(p string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(embedDir, p)
		if err != nil {
			return err
		}
		target := filepath.Join(destDir, filepath.FromSlash(rel))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyEmbedFile(p, target)
	})
}

func copyEmbedFile(embedPath, destPath string) error {
	data, err := fs.ReadFile(embeddedDepartments, embedPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}
	mode := os.FileMode(0o644)
	switch strings.ToLower(filepath.Ext(destPath)) {
	case ".sh", ".py":
		mode = 0o755
	}
	return os.WriteFile(destPath, data, mode)
}

// promptYesNo asks the user a yes/no question on the interactive
// terminal. Treats anything starting with 'y' / 'Y' as yes; everything
// else is no (matching install.sh's defaults-to-skip behaviour). If
// stdin is not a terminal (piped input, CI), the caller should prefer
// --force to avoid a hang; this function just reads whatever it gets.
func promptYesNo(question string, stdin io.Reader, stdout io.Writer) (bool, error) {
	if stdin == nil {
		stdin = os.Stdin
	}
	if stdout == nil {
		stdout = os.Stdout
	}
	fmt.Fprintf(stdout, "%s [y/N] ", question)
	scanner := bufio.NewScanner(stdin)
	if !scanner.Scan() {
		// No input (EOF) → treat as no. Mirrors the shell behaviour of
		// defaulting to skip when the user hits enter.
		return false, nil
	}
	reply := strings.TrimSpace(scanner.Text())
	return strings.HasPrefix(strings.ToLower(reply), "y"), nil
}

// installedSkills returns the set of skills currently installed at
// targetDir. A "skill" is any subdirectory that contains a SKILL.md —
// other folders (user's custom stuff, other tools' skills) are
// ignored so we never touch anything we didn't install ourselves.
func installedSkills(targetDir string) ([]string, error) {
	entries, err := os.ReadDir(targetDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	var out []string
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if _, err := os.Stat(filepath.Join(targetDir, e.Name(), "SKILL.md")); err == nil {
			out = append(out, e.Name())
		}
	}
	return out, nil
}

// findDepartmentOf looks up which embedded department owns a given
// skill slug. Returns "" if the slug isn't in the embed. Used by
// `skillskit update` to re-copy an installed skill from its
// department source, and by `remove` when the user gives just a slug.
func findDepartmentOf(slug string) string {
	depts, _ := listEmbeddedDepartments()
	for _, d := range depts {
		skills, _ := listEmbeddedSkills(d)
		for _, s := range skills {
			if s == slug {
				return d
			}
		}
	}
	return ""
}
