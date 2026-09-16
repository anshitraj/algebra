package mcpserver

import (
	"context"

	gomcp "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/project-algebra/algebra/internal/domain/privacy"
)

type profileAliasesOutput struct {
	Aliases []string `json:"aliases"`
}

// registerProfilesTools wires profiles.list_shipping_profiles and
// profiles.list_payment_profiles. Both return ALIASES ONLY — never a
// resolved address, phone, or payment credential. That resolution only
// ever happens inside privacy.Resolver, called from merchant-execution code
// paths that never serialize their result back through MCP (mandate §24).
func (srv *Server) registerProfilesTools(s *gomcp.Server) {
	gomcp.AddTool(s, &gomcp.Tool{
		Name:        "profiles.list_shipping_profiles",
		Description: "List the calling user's shipping profile aliases (e.g. 'shipping:home'), never the resolved address.",
	}, func(ctx context.Context, _ *gomcp.CallToolRequest, in agentTokenOnlyInput) (*gomcp.CallToolResult, profileAliasesOutput, error) {
		ag, err := srv.resolveAgent(ctx, in.AgentToken)
		if err != nil {
			return nil, profileAliasesOutput{}, err
		}
		aliases, err := srv.Privacy.ListAliases(ctx, ag.UserID, privacy.ProfileShipping)
		if err != nil {
			return nil, profileAliasesOutput{}, err
		}
		return nil, profileAliasesOutput{Aliases: aliases}, nil
	})

	gomcp.AddTool(s, &gomcp.Tool{
		Name:        "profiles.list_payment_profiles",
		Description: "List the calling user's payment source aliases (e.g. 'payment:personal'), never card details.",
	}, func(ctx context.Context, _ *gomcp.CallToolRequest, in agentTokenOnlyInput) (*gomcp.CallToolResult, profileAliasesOutput, error) {
		ag, err := srv.resolveAgent(ctx, in.AgentToken)
		if err != nil {
			return nil, profileAliasesOutput{}, err
		}
		sources, err := srv.Payments.ListSources(ctx, ag.ID, ag.UserID)
		if err != nil {
			return nil, profileAliasesOutput{}, err
		}
		aliases := make([]string, len(sources))
		for i, src := range sources {
			aliases[i] = src.Alias
		}
		return nil, profileAliasesOutput{Aliases: aliases}, nil
	})
}
