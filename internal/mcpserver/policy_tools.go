package mcpserver

import (
	"context"

	gomcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

// registerPolicyTools wires policy.evaluate_intent (a read-only preview —
// see PolicyService.PreviewDecision) and policy.explain_decision (surfaces
// the actually-recorded decision for an intent, not a generated
// explanation of it).
func (srv *Server) registerPolicyTools(s *gomcp.Server) {
	gomcp.AddTool(s, &gomcp.Tool{
		Name:        "policy.evaluate_intent",
		Description: "Preview whether the intent's selected quote would currently be ALLOWed, DENYed, or REQUIRE_APPROVAL, without changing any state.",
	}, func(ctx context.Context, _ *gomcp.CallToolRequest, in intentIDInput) (*gomcp.CallToolResult, decisionOutput, error) {
		ag, err := srv.resolveAgent(ctx, in.AgentToken)
		if err != nil {
			return nil, decisionOutput{}, err
		}
		dec, err := srv.Policy.PreviewDecision(ctx, ag.ID, in.IntentID)
		if err != nil {
			return nil, decisionOutput{}, err
		}
		return nil, toDecisionOutput(dec), nil
	})

	gomcp.AddTool(s, &gomcp.Tool{
		Name:        "policy.explain_decision",
		Description: "Return the most recently recorded policy decision and reason codes for an intent.",
	}, func(ctx context.Context, _ *gomcp.CallToolRequest, in intentIDInput) (*gomcp.CallToolResult, decisionOutput, error) {
		ag, err := srv.resolveAgent(ctx, in.AgentToken)
		if err != nil {
			return nil, decisionOutput{}, err
		}
		dec, err := srv.Policy.ExplainDecision(ctx, ag.ID, in.IntentID)
		if err != nil {
			return nil, decisionOutput{}, err
		}
		return nil, toDecisionOutput(dec), nil
	})
}
