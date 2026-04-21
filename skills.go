package main

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Skill is the parsed form of a SKILL.md frontmatter block plus the
// repo-relative path. The full body isn't kept in memory — we load it
// lazily when the user runs `skillskit show`.
type Skill struct {
	Name            string   `yaml:"name"`
	Description     string   `yaml:"description"`
	Safety          string   `yaml:"safety"`
	SupportedStacks []string `yaml:"supported-stacks"`
	Produces        string   `yaml:"produces"`
	Consumes        []string `yaml:"consumes"`
	Chains          []string `yaml:"chains"`
	// Department the skill belongs to (derived from path).
	Department string `yaml:"-"`
	// EmbedPath is the path inside embeddedDepartments — i.e.
	// "departments/developers/skills/code-review/SKILL.md".
	EmbedPath string `yaml:"-"`
}

// IsOrchestrator is true when chains is non-empty — matches the
// orchestrator definition used across the kit.
func (s Skill) IsOrchestrator() bool {
	return len(s.Chains) > 0
}

// listEmbeddedDepartments returns the directory names under departments/
// in the embedded filesystem. Sorted for stable output.
func listEmbeddedDepartments() ([]string, error) {
	entries, err := fs.ReadDir(embeddedDepartments, "departments")
	if err != nil {
		return nil, fmt.Errorf("read departments/: %w", err)
	}
	var out []string
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		out = append(out, e.Name())
	}
	sort.Strings(out)
	return out, nil
}

// listEmbeddedSkills returns the skill folder names under a given
// department — e.g. listEmbeddedSkills("developers") → ["api-design",
// "code-review", ...]. Sorted.
func listEmbeddedSkills(department string) ([]string, error) {
	dir := path.Join("departments", department, "skills")
	entries, err := fs.ReadDir(embeddedDepartments, dir)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	var out []string
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		out = append(out, e.Name())
	}
	sort.Strings(out)
	return out, nil
}

// loadSkill reads and parses the SKILL.md for the given department+slug.
// Returns an error wrapping the path if the frontmatter is missing or
// malformed.
func loadSkill(department, slug string) (*Skill, error) {
	embedPath := path.Join("departments", department, "skills", slug, "SKILL.md")
	raw, err := fs.ReadFile(embeddedDepartments, embedPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", embedPath, err)
	}
	fm, _, err := splitFrontmatter(raw)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", embedPath, err)
	}
	var s Skill
	if err := yaml.Unmarshal(fm, &s); err != nil {
		return nil, fmt.Errorf("%s: frontmatter parse: %w", embedPath, err)
	}
	if s.Name == "" {
		s.Name = slug
	}
	s.Department = department
	s.EmbedPath = embedPath
	return &s, nil
}

// loadSkillBody returns the raw SKILL.md content (frontmatter + body).
// Kept separate from loadSkill because the body is large and only
// `skillskit show` needs it.
func loadSkillBody(department, slug string) ([]byte, error) {
	embedPath := path.Join("departments", department, "skills", slug, "SKILL.md")
	return fs.ReadFile(embeddedDepartments, embedPath)
}

// allSkills loads every embedded skill. Returned in stable order
// (department alphabetical, then slug alphabetical). Used by list,
// search, and customize commands.
func allSkills() ([]*Skill, error) {
	depts, err := listEmbeddedDepartments()
	if err != nil {
		return nil, err
	}
	var out []*Skill
	for _, d := range depts {
		slugs, err := listEmbeddedSkills(d)
		if err != nil {
			return nil, err
		}
		for _, s := range slugs {
			sk, err := loadSkill(d, s)
			if err != nil {
				// Skip malformed skills rather than failing the whole
				// command — a user shouldn't be blocked from listing the
				// good skills because one has a frontmatter typo. The
				// error gets printed to stderr for visibility.
				fmt.Fprintf(os.Stderr, "warning: skipping %s: %v\n", s, err)
				continue
			}
			out = append(out, sk)
		}
	}
	return out, nil
}

// skillDirPath returns the embed-relative directory containing all files
// (SKILL.md, references/, scripts/) for a given skill. Used by the
// installer to copy the whole folder.
func skillDirPath(department, slug string) string {
	return path.Join("departments", department, "skills", slug)
}

// splitFrontmatter splits a SKILL.md into its YAML frontmatter and body
// halves. Expects the file to start with "---\n". Returns the raw YAML
// bytes (between the delimiters) and the body bytes (after the closing
// delimiter). An error is returned when the file doesn't have the
// expected shape.
func splitFrontmatter(raw []byte) (yamlBytes, body []byte, err error) {
	s := string(raw)
	if !strings.HasPrefix(s, "---\n") && !strings.HasPrefix(s, "---\r\n") {
		return nil, nil, fmt.Errorf("missing opening --- frontmatter delimiter")
	}
	// Skip the first delimiter line.
	rest := s
	if strings.HasPrefix(rest, "---\r\n") {
		rest = rest[5:]
	} else {
		rest = rest[4:]
	}
	// Find the closing delimiter. Must be a line consisting only of ---.
	closeIdx := indexClosingDelim(rest)
	if closeIdx < 0 {
		return nil, nil, fmt.Errorf("missing closing --- frontmatter delimiter")
	}
	yamlPart := rest[:closeIdx]
	// Body starts after the closing delimiter line.
	afterClose := skipLine(rest, closeIdx)
	return []byte(yamlPart), []byte(afterClose), nil
}

// indexClosingDelim returns the byte offset of the "---" line that
// terminates the YAML frontmatter. Returns -1 if not found.
func indexClosingDelim(rest string) int {
	// Scan line by line. A delimiter line is "---" followed by \n or
	// \r\n or EOF.
	i := 0
	for i < len(rest) {
		lineEnd := strings.IndexByte(rest[i:], '\n')
		var line string
		if lineEnd < 0 {
			line = rest[i:]
		} else {
			line = rest[i : i+lineEnd]
		}
		if strings.TrimRight(line, "\r ") == "---" {
			return i
		}
		if lineEnd < 0 {
			return -1
		}
		i += lineEnd + 1
	}
	return -1
}

// skipLine returns the substring after the line starting at `from`.
func skipLine(s string, from int) string {
	rest := s[from:]
	nl := strings.IndexByte(rest, '\n')
	if nl < 0 {
		return ""
	}
	return rest[nl+1:]
}
