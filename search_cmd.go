package main

import (
	"fmt"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search <query>",
	Short: "Search embedded skills by name, description, or supported stack",
	Long: `Case-insensitive substring search across each skill's name,
description, and supported-stacks list. Ranked: name matches first, then
description matches, then stack matches — matches are shown in order.

Multi-word queries are treated as AND — every word must appear somewhere
in the fields above. Quotes are not required.

Examples:
  skillskit search "code review"
  skillskit search prometheus
  skillskit search "slack notifications"
  skillskit search openapi -n 20              # show up to 20 hits`,
	Args: cobra.MinimumNArgs(1),
	RunE: runSearch,
}

var searchLimit int

func init() {
	searchCmd.Flags().IntVarP(&searchLimit, "limit", "n", 10,
		"maximum number of results to show")
	rootCmd.AddCommand(searchCmd)
}

func runSearch(cmd *cobra.Command, args []string) error {
	query := strings.ToLower(strings.Join(args, " "))
	terms := strings.Fields(query)
	if len(terms) == 0 {
		return errf("provide at least one search term")
	}

	skills, err := allSkills()
	if err != nil {
		return err
	}

	type hit struct {
		skill *Skill
		score int   // higher = better match
		where []string
	}
	var hits []hit

	for _, s := range skills {
		score, where, ok := matchScore(s, terms)
		if !ok {
			continue
		}
		hits = append(hits, hit{skill: s, score: score, where: where})
	}

	if len(hits) == 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "No matches for %q.\n", strings.Join(args, " "))
		return nil
	}

	sort.SliceStable(hits, func(i, j int) bool {
		if hits[i].score != hits[j].score {
			return hits[i].score > hits[j].score // higher first
		}
		return hits[i].skill.Name < hits[j].skill.Name
	})

	if len(hits) > searchLimit {
		hits = hits[:searchLimit]
	}

	tw := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "SLUG\tDEPARTMENT\tSAFETY\tMATCHED\tDESCRIPTION")
	fmt.Fprintln(tw, "----\t----------\t------\t-------\t-----------")
	for _, h := range hits {
		desc := h.skill.Description
		if len(desc) > 70 {
			desc = desc[:67] + "..."
		}
		name := h.skill.Name
		if h.skill.IsOrchestrator() {
			name += "*"
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n",
			name, h.skill.Department, h.skill.Safety,
			strings.Join(h.where, "+"), desc,
		)
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	fmt.Fprintf(cmd.OutOrStdout(), "\n%d match(es). Run `skillskit show <slug>` for the full SKILL.md.\n",
		len(hits),
	)
	return nil
}

// matchScore returns (score, whereMatched, ok). Higher score = better
// match. whereMatched is a short list like ["name", "desc", "stack"]
// so the user can see what fields their query hit. ok=false means no
// match at all — caller should skip.
//
// Scoring:
//   name full match       = 100
//   name starts-with      = 50 per term
//   name substring        = 30 per term
//   description substring = 10 per term
//   stack substring       = 5  per term
// Multiple terms must ALL match somewhere in the skill; otherwise ok=false.
func matchScore(s *Skill, terms []string) (int, []string, bool) {
	name := strings.ToLower(s.Name)
	desc := strings.ToLower(s.Description)
	stacks := strings.ToLower(strings.Join(s.SupportedStacks, " "))

	var score int
	whereSet := map[string]bool{}
	for _, t := range terms {
		termHit := false
		if name == t {
			score += 100
			whereSet["name"] = true
			termHit = true
		} else if strings.HasPrefix(name, t) {
			score += 50
			whereSet["name"] = true
			termHit = true
		} else if strings.Contains(name, t) {
			score += 30
			whereSet["name"] = true
			termHit = true
		}
		if strings.Contains(desc, t) {
			score += 10
			whereSet["desc"] = true
			termHit = true
		}
		if stacks != "" && strings.Contains(stacks, t) {
			score += 5
			whereSet["stack"] = true
			termHit = true
		}
		if !termHit {
			return 0, nil, false // AND across terms
		}
	}

	where := make([]string, 0, len(whereSet))
	for w := range whereSet {
		where = append(where, w)
	}
	sort.Strings(where)
	return score, where, true
}
