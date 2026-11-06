// Real scan of github.com/cmonson66/nectarpay-crm produced with a
// ts-morph pass that follows docs/ENGINE_SPEC.md. Drawn by the landing hero and
// the new map background, and available to tests; the app reads live actions.
import type { MapData } from "./types";

export const FIXTURE_REPO_ID = "fixture";

export const fixtureMap: MapData = {
 "status": "ready",
 "statusDetail": null,
 "repo": {
  "owner": "cmonson66",
  "name": "nectarpay-crm",
  "htmlUrl": "https://github.com/cmonson66/nectarpay-crm",
  "sha": "7871c76"
 },
 "files": [
  {
   "path": "eslint.config.js",
   "lines": 41,
   "imports": [],
   "copies": 0
  },
  {
   "path": "vite.config.ts",
   "lines": 41,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/router.tsx",
   "lines": 32,
   "imports": [
    "src/routeTree.gen.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routeTree.gen.ts",
   "lines": 1483,
   "imports": [
    "src/routes/__root.tsx",
    "src/routes/set-password.tsx",
    "src/routes/auth.tsx",
    "src/routes/_authenticated.tsx",
    "src/routes/index.tsx",
    "src/routes/_authenticated.crm.tsx",
    "src/routes/_authenticated.admin.tsx",
    "src/routes/_authenticated.crm.index.tsx",
    "src/routes/_authenticated.admin.index.tsx",
    "src/routes/_authenticated.crm.tasks.tsx",
    "src/routes/_authenticated.crm.settings.tsx",
    "src/routes/_authenticated.crm.map.tsx",
    "src/routes/_authenticated.crm.contingents.tsx",
    "src/routes/_authenticated.crm.commissions.tsx",
    "src/routes/_authenticated.crm.campaigns.tsx",
    "src/routes/_authenticated.admin.users.tsx",
    "src/routes/_authenticated.admin.settings.tsx",
    "src/routes/_authenticated.admin.messaging.tsx",
    "src/routes/_authenticated.admin.markets.tsx",
    "src/routes/_authenticated.admin.knowledge.tsx",
    "src/routes/_authenticated.admin.devices.tsx",
    "src/routes/_authenticated.admin.commissions.tsx",
    "src/routes/_authenticated.crm.team.index.tsx",
    "src/routes/_authenticated.crm.leads.index.tsx",
    "src/routes/_authenticated.admin.knowledge.index.tsx",
    "src/routes/lovable/email/queue/process.ts",
    "src/routes/lovable/email/auth/webhook.ts",
    "src/routes/lovable/email/auth/preview.ts",
    "src/routes/api/public/twilio/voice-app.ts",
    "src/routes/api/public/twilio/voice.ts",
    "src/routes/api/public/twilio/sms-status.ts",
    "src/routes/api/public/twilio/sms.ts",
    "src/routes/api/public/twilio/recording.ts",
    "src/routes/api/public/twilio/call-status.ts",
    "src/routes/api/public/telegram/webhook.ts",
    "src/routes/api/public/nectarpay/webhook.ts",
    "src/routes/api/public/leads/intake.ts",
    "src/routes/api/public/e/unsubscribe.ts",
    "src/routes/api/public/e/open.ts",
    "src/routes/api/public/e/click.ts",
    "src/routes/api/public/docs/$token.ts",
    "src/routes/api/public/cron/contingents.ts",
    "src/routes/api/public/auth/wallet-status.ts",
    "src/routes/api/public/auth/wallet-exchange.ts",
    "src/routes/api/public/auth/wallet-challenge.ts",
    "src/routes/api/public/auth/wallet-callback.ts",
    "src/routes/_authenticated.crm.team.$repId.tsx",
    "src/routes/_authenticated.crm.leads.$id.tsx",
    "src/routes/_authenticated.admin.knowledge.terms.tsx",
    "src/routes/_authenticated.admin.knowledge.privacy.tsx",
    "src/routes/_authenticated.admin.knowledge.new.tsx",
    "src/routes/_authenticated.admin.knowledge.members-heatmap.tsx",
    "src/routes/_authenticated.admin.knowledge.manifesto.tsx",
    "src/routes/_authenticated.admin.knowledge.executive-summary.tsx",
    "src/routes/_authenticated.admin.knowledge.convenience-doctrine.tsx",
    "src/routes/_authenticated.admin.knowledge.training.sales-reps.tsx",
    "src/routes/_authenticated.admin.knowledge.training.merchant-onboarding.tsx",
    "src/routes/_authenticated.admin.knowledge.training.cryptopop.tsx",
    "src/routes/_authenticated.admin.knowledge.pitch.new-markets.tsx",
    "src/routes/_authenticated.admin.knowledge.pitch.merchants.tsx",
    "src/routes/_authenticated.admin.knowledge.pitch.consumers.tsx",
    "src/routes/_authenticated.admin.knowledge.item.$itemId.tsx",
    "src/routes/api/public/docs/$token.file.$id.ts",
    "src/routes/_authenticated.admin.knowledge.item.$itemId.edit.tsx",
    "src/router.tsx",
    "src/start.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/server.ts",
   "lines": 55,
   "imports": [
    "src/lib/error-capture.ts",
    "src/lib/error-page.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/start.ts",
   "lines": 25,
   "imports": [
    "src/lib/error-page.ts",
    "src/integrations/supabase/auth-attacher.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/knowledge-shell.tsx",
   "lines": 420,
   "imports": [
    "src/lib/knowledge.functions.ts",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/pwa-install-prompt.tsx",
   "lines": 148,
   "imports": [
    "src/lib/utils.ts",
    "src/hooks/use-mobile.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/components/theme-toggle.tsx",
   "lines": 22,
   "imports": [
    "src/lib/theme.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/hooks/use-mobile.tsx",
   "lines": 20,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/admin.functions.ts",
   "lines": 86,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/agreement-terms.ts",
   "lines": 131,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/auth-context.tsx",
   "lines": 73,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/beep.ts",
   "lines": 25,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/commissions.functions.ts",
   "lines": 434,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/weeks.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/commissions.server.ts",
   "lines": 125,
   "imports": [
    "src/integrations/supabase/client.server.ts",
    "src/lib/weeks.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/comms.functions.ts",
   "lines": 442,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/contingent-maintenance.server.ts",
   "lines": 11,
   "imports": [
    "src/integrations/supabase/client.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/credentials-email.server.ts",
   "lines": 116,
   "imports": [
    "src/lib/email-campaigns.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/crm.functions.ts",
   "lines": 371,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/phone.ts",
    "src/lib/geo.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/cron-auth.server.ts",
   "lines": 17,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/dashboard.functions.ts",
   "lines": 441,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/deal-documents.functions.ts",
   "lines": 69,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/deal-documents.server.ts",
   "lines": 598,
   "imports": [
    "src/integrations/supabase/types.ts",
    "src/lib/agreement-terms.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/deals.functions.ts",
   "lines": 546,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/integrations/supabase/types.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/doc-share.server.ts",
   "lines": 56,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/email-campaigns.functions.ts",
   "lines": 227,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-campaigns.server.ts",
   "lines": 136,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 2
  },
  {
   "path": "src/lib/embed.ts",
   "lines": 40,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/error-capture.ts",
   "lines": 28,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/error-page.ts",
   "lines": 31,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/geo-schemas.ts",
   "lines": 67,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/geo.functions.ts",
   "lines": 344,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/geo.server.ts",
    "src/lib/geo-schemas.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/geo.server.ts",
   "lines": 339,
   "imports": [],
   "copies": 1
  },
  {
   "path": "src/lib/knowledge.functions.ts",
   "lines": 236,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/knowledge.server.ts",
    "src/integrations/supabase/types.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/knowledge.server.ts",
   "lines": 25,
   "imports": [
    "src/integrations/supabase/types.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/lead-status.ts",
   "lines": 39,
   "imports": [
    "src/lib/crm.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/leads.functions.ts",
   "lines": 338,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/lovable-error-reporting.ts",
   "lines": 37,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/members-geo.functions.ts",
   "lines": 83,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/nav-groups.tsx",
   "lines": 137,
   "imports": [
    "src/components/crm/shell.tsx",
    "src/lib/crm.functions.ts",
    "src/lib/deals.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/nectarpay.server.ts",
   "lines": 103,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/notify.functions.ts",
   "lines": 115,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/notify.server.ts",
   "lines": 112,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/phone.ts",
   "lines": 29,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/places.functions.ts",
   "lines": 14,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/places.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/places.server.ts",
   "lines": 108,
   "imports": [],
   "copies": 1
  },
  {
   "path": "src/lib/qr.ts",
   "lines": 45,
   "imports": [],
   "copies": 2
  },
  {
   "path": "src/lib/theme.tsx",
   "lines": 78,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/twilio-token.server.ts",
   "lines": 55,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/twilio.server.ts",
   "lines": 126,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/use-live-location.ts",
   "lines": 86,
   "imports": [
    "src/lib/geo.functions.ts",
    "src/lib/geo-schemas.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/user-admin.functions.ts",
   "lines": 522,
   "imports": [
    "src/integrations/supabase/auth-middleware.ts",
    "src/lib/geo.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/utils.ts",
   "lines": 7,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/wallet-auth-shared.ts",
   "lines": 194,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/wallet-signature.server.ts",
   "lines": 269,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/weeks.ts",
   "lines": 108,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/__root.tsx",
   "lines": 180,
   "imports": [
    "src/lib/lovable-error-reporting.ts",
    "src/lib/auth-context.tsx",
    "src/lib/theme.tsx",
    "src/components/pwa-install-prompt.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.commissions.tsx",
   "lines": 211,
   "imports": [
    "src/components/crm/loading-state.tsx",
    "src/lib/commissions.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.devices.tsx",
   "lines": 779,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/barcode-scanner.tsx",
    "src/components/crm/device-rollup.tsx",
    "src/components/crm/bulk-assign-terminals.tsx",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.index.tsx",
   "lines": 99,
   "imports": [
    "src/lib/admin.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.convenience-doctrine.tsx",
   "lines": 151,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.executive-summary.tsx",
   "lines": 149,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.fast-start.tsx",
   "lines": 13,
   "imports": [
    "src/components/fast-start/fast-start-drills.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.index.tsx",
   "lines": 378,
   "imports": [
    "src/components/knowledge-shell.tsx",
    "src/lib/knowledge.functions.ts",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.item.$itemId.edit.tsx",
   "lines": 53,
   "imports": [
    "src/lib/knowledge.functions.ts",
    "src/components/knowledge/item-form.tsx",
    "src/components/knowledge-shell.tsx",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.item.$itemId.tsx",
   "lines": 132,
   "imports": [
    "src/lib/knowledge.functions.ts",
    "src/components/knowledge/viewers.tsx",
    "src/components/knowledge-shell.tsx",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.manifesto.tsx",
   "lines": 102,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.members-heatmap.tsx",
   "lines": 198,
   "imports": [
    "src/components/knowledge-shell.tsx",
    "src/lib/members-geo.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.new.tsx",
   "lines": 38,
   "imports": [
    "src/components/knowledge/item-form.tsx",
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.pitch.consumers.tsx",
   "lines": 130,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.pitch.merchants.tsx",
   "lines": 201,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.pitch.new-markets.tsx",
   "lines": 171,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.privacy.tsx",
   "lines": 103,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.terms.tsx",
   "lines": 106,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.training.cryptopop.tsx",
   "lines": 130,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.training.merchant-onboarding.tsx",
   "lines": 147,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.training.sales-reps.tsx",
   "lines": 195,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.knowledge.tsx",
   "lines": 7,
   "imports": [
    "src/components/knowledge-shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.markets.tsx",
   "lines": 215,
   "imports": [
    "src/lib/leads.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.messaging.tsx",
   "lines": 183,
   "imports": [
    "src/lib/comms.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.settings.tsx",
   "lines": 10,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.tsx",
   "lines": 92,
   "imports": [
    "src/integrations/supabase/client.ts",
    "src/lib/auth-context.tsx",
    "src/components/crm/shell.tsx",
    "src/lib/nav-groups.tsx",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.admin.users.tsx",
   "lines": 976,
   "imports": [
    "src/lib/user-admin.functions.ts",
    "src/components/crm/address-autocomplete.tsx",
    "src/components/crm/kit.tsx",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.campaigns.tsx",
   "lines": 477,
   "imports": [
    "src/integrations/supabase/client.ts",
    "src/lib/comms.functions.ts",
    "src/lib/email-campaigns.functions.ts",
    "src/components/crm/loading-state.tsx",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.commissions.tsx",
   "lines": 626,
   "imports": [
    "src/components/crm/loading-state.tsx",
    "src/lib/commissions.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.contingents.tsx",
   "lines": 238,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.index.tsx",
   "lines": 460,
   "imports": [
    "src/lib/dashboard.functions.ts",
    "src/lib/crm.functions.ts",
    "src/lib/deals.functions.ts",
    "src/components/crm/loading-state.tsx",
    "src/lib/lead-status.ts",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.leads.$id.tsx",
   "lines": 677,
   "imports": [
    "src/lib/crm.functions.ts",
    "src/lib/phone.ts",
    "src/lib/lead-status.ts",
    "src/lib/deals.functions.ts",
    "src/lib/deal-documents.functions.ts",
    "src/components/crm/lead-sales-card.tsx",
    "src/components/crm/lead-hardware.tsx",
    "src/components/crm/nearby-prospects.tsx",
    "src/components/crm/conversation.tsx",
    "src/components/crm/modals.tsx",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/kit.tsx",
    "src/components/crm/address-autocomplete.tsx",
    "src/hooks/use-mobile.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.leads.index.tsx",
   "lines": 562,
   "imports": [
    "src/lib/crm.functions.ts",
    "src/lib/lead-status.ts",
    "src/lib/phone.ts",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/modals.tsx",
    "src/components/crm/use-deal-values.ts",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.map.tsx",
   "lines": 450,
   "imports": [
    "src/lib/geo.functions.ts",
    "src/lib/geo-schemas.ts",
    "src/lib/use-live-location.ts",
    "src/components/crm/leaflet-map.tsx",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/lead-status.ts",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.settings.tsx",
   "lines": 136,
   "imports": [
    "src/lib/geo.functions.ts",
    "src/components/crm/address-autocomplete.tsx",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.tasks.tsx",
   "lines": 244,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/loading-state.tsx",
    "src/components/crm/modals.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.team.$repId.tsx",
   "lines": 253,
   "imports": [
    "src/lib/dashboard.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.team.index.tsx",
   "lines": 192,
   "imports": [
    "src/lib/dashboard.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.crm.tsx",
   "lines": 35,
   "imports": [
    "src/integrations/supabase/client.ts",
    "src/components/crm/shell.tsx",
    "src/lib/nav-groups.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/_authenticated.tsx",
   "lines": 29,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/auth.tsx",
   "lines": 304,
   "imports": [
    "src/integrations/supabase/client.ts",
    "src/integrations/lovable/index.ts",
    "src/lib/auth-context.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/index.tsx",
   "lines": 9,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/set-password.tsx",
   "lines": 115,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/address-autocomplete.tsx",
   "lines": 141,
   "imports": [
    "src/lib/utils.ts",
    "src/lib/geo.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/barcode-scanner.tsx",
   "lines": 168,
   "imports": [
    "src/lib/beep.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/bulk-assign-terminals.tsx",
   "lines": 225,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/barcode-scanner.tsx",
    "src/lib/beep.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/conversation.tsx",
   "lines": 488,
   "imports": [
    "src/lib/comms.functions.ts",
    "src/lib/deals.functions.ts",
    "src/lib/crm.functions.ts",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/device-rollup.tsx",
   "lines": 292,
   "imports": [
    "src/lib/deals.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/kit.tsx",
   "lines": 551,
   "imports": [
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/lead-comms-panel.tsx",
   "lines": 157,
   "imports": [
    "src/lib/comms.functions.ts",
    "src/components/crm/softphone.tsx",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/lead-deals-panel.tsx",
   "lines": 304,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/loading-state.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/lead-hardware.tsx",
   "lines": 115,
   "imports": [
    "src/lib/crm.functions.ts",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/lead-sales-card.tsx",
   "lines": 176,
   "imports": [
    "src/lib/deals.functions.ts",
    "src/components/crm/lead-deals-panel.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/leaflet-map.tsx",
   "lines": 319,
   "imports": [
    "src/lib/crm.functions.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/loading-state.tsx",
   "lines": 35,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/components/crm/mobile-nav.tsx",
   "lines": 101,
   "imports": [
    "src/lib/auth-context.tsx",
    "src/components/crm/shell.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/modals.tsx",
   "lines": 1304,
   "imports": [
    "src/lib/agreement-terms.ts",
    "src/lib/crm.functions.ts",
    "src/lib/deal-documents.functions.ts",
    "src/lib/deals.functions.ts",
    "src/lib/places.functions.ts",
    "src/lib/places.server.ts",
    "src/components/crm/kit.tsx",
    "src/components/crm/barcode-scanner.tsx",
    "src/components/crm/address-autocomplete.tsx",
    "src/lib/utils.ts",
    "src/hooks/use-mobile.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/nearby-prospects.tsx",
   "lines": 275,
   "imports": [
    "src/lib/geo.functions.ts",
    "src/components/crm/leaflet-map.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/shell.tsx",
   "lines": 497,
   "imports": [
    "src/lib/auth-context.tsx",
    "src/lib/theme.tsx",
    "src/lib/utils.ts",
    "src/components/crm/kit.tsx",
    "src/components/crm/softphone.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/softphone.tsx",
   "lines": 286,
   "imports": [
    "src/lib/comms.functions.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/crm/use-deal-values.ts",
   "lines": 29,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/fast-start/fast-start-drills.tsx",
   "lines": 407,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/components/fast-start/network-harvesting-form.tsx",
   "lines": 206,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/components/knowledge/item-form.tsx",
   "lines": 305,
   "imports": [
    "src/integrations/supabase/client.ts",
    "src/lib/auth-context.tsx",
    "src/lib/knowledge.functions.ts",
    "src/lib/embed.ts",
    "src/components/knowledge/rich-text-editor.tsx",
    "src/components/knowledge/viewers.tsx",
    "src/components/crm/kit.tsx",
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/knowledge/rich-text-editor.tsx",
   "lines": 115,
   "imports": [
    "src/lib/utils.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/components/knowledge/viewers.tsx",
   "lines": 92,
   "imports": [
    "src/components/crm/kit.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/integrations/lovable/index.ts",
   "lines": 39,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/integrations/supabase/auth-attacher.ts",
   "lines": 16,
   "imports": [
    "src/integrations/supabase/client.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/integrations/supabase/auth-middleware.ts",
   "lines": 110,
   "imports": [
    "src/integrations/supabase/types.ts"
   ],
   "copies": 1
  },
  {
   "path": "src/integrations/supabase/client.server.ts",
   "lines": 70,
   "imports": [
    "src/integrations/supabase/types.ts"
   ],
   "copies": 1
  },
  {
   "path": "src/integrations/supabase/client.ts",
   "lines": 70,
   "imports": [
    "src/integrations/supabase/types.ts",
    "src/integrations/supabase/previewAuthStorage.ts"
   ],
   "copies": 1
  },
  {
   "path": "src/integrations/supabase/previewAuthStorage.ts",
   "lines": 89,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/integrations/supabase/types.ts",
   "lines": 2135,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/_brand.tsx",
   "lines": 221,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/email-change.tsx",
   "lines": 51,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/invite.tsx",
   "lines": 42,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/magic-link.tsx",
   "lines": 101,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/reauthentication.tsx",
   "lines": 38,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/recovery.tsx",
   "lines": 37,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/lib/email-templates/signup.tsx",
   "lines": 47,
   "imports": [
    "src/lib/email-templates/_brand.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/auth/wallet-callback.ts",
   "lines": 197,
   "imports": [
    "src/lib/wallet-auth-shared.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/auth/wallet-challenge.ts",
   "lines": 85,
   "imports": [
    "src/lib/wallet-auth-shared.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/auth/wallet-exchange.ts",
   "lines": 159,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/auth/wallet-status.ts",
   "lines": 54,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/cron/contingents.ts",
   "lines": 24,
   "imports": [
    "src/lib/cron-auth.server.ts",
    "src/lib/contingent-maintenance.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/docs/$token.file.$id.ts",
   "lines": 37,
   "imports": [
    "src/lib/doc-share.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/docs/$token.ts",
   "lines": 79,
   "imports": [
    "src/lib/doc-share.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/e/click.ts",
   "lines": 142,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/e/open.ts",
   "lines": 43,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/e/unsubscribe.ts",
   "lines": 61,
   "imports": [],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/leads/intake.ts",
   "lines": 115,
   "imports": [
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/nectarpay/webhook.ts",
   "lines": 145,
   "imports": [
    "src/lib/nectarpay.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/telegram/webhook.ts",
   "lines": 108,
   "imports": [
    "src/lib/notify.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/call-status.ts",
   "lines": 79,
   "imports": [
    "src/lib/twilio.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/recording.ts",
   "lines": 30,
   "imports": [
    "src/lib/twilio.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/sms-status.ts",
   "lines": 29,
   "imports": [
    "src/lib/twilio.server.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/sms.ts",
   "lines": 88,
   "imports": [
    "src/lib/twilio.server.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/voice-app.ts",
   "lines": 136,
   "imports": [
    "src/lib/twilio.server.ts",
    "src/lib/twilio-token.server.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/api/public/twilio/voice.ts",
   "lines": 35,
   "imports": [
    "src/lib/twilio.server.ts",
    "src/lib/phone.ts"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/lovable/email/auth/preview.ts",
   "lines": 117,
   "imports": [
    "src/lib/email-templates/signup.tsx",
    "src/lib/email-templates/invite.tsx",
    "src/lib/email-templates/magic-link.tsx",
    "src/lib/email-templates/recovery.tsx",
    "src/lib/email-templates/email-change.tsx",
    "src/lib/email-templates/reauthentication.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/lovable/email/auth/webhook.ts",
   "lines": 223,
   "imports": [
    "src/lib/email-templates/signup.tsx",
    "src/lib/email-templates/invite.tsx",
    "src/lib/email-templates/magic-link.tsx",
    "src/lib/email-templates/recovery.tsx",
    "src/lib/email-templates/email-change.tsx",
    "src/lib/email-templates/reauthentication.tsx"
   ],
   "copies": 0
  },
  {
   "path": "src/routes/lovable/email/queue/process.ts",
   "lines": 327,
   "imports": [],
   "copies": 2
  }
 ],
 "sets": [
  {
   "id": "11bcbd3df1be",
   "name": "createSupabaseFetch",
   "kind": "exact",
   "isComponent": false,
   "members": [
    {
     "id": "src/integrations/supabase/auth-middleware.ts#createSupabaseFetch#13",
     "name": "createSupabaseFetch",
     "path": "src/integrations/supabase/auth-middleware.ts",
     "line": 13,
     "endLine": 31,
     "lines": 19,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/integrations/supabase/client.server.ts#createSupabaseFetch#12",
     "name": "createSupabaseFetch",
     "path": "src/integrations/supabase/client.server.ts",
     "line": 12,
     "endLine": 30,
     "lines": 19,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/integrations/supabase/client.ts#createSupabaseFetch#10",
     "name": "createSupabaseFetch",
     "path": "src/integrations/supabase/client.ts",
     "line": 10,
     "endLine": 28,
     "lines": 19,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    }
   ],
   "duplicateLines": 38,
   "mergeable": true
  },
  {
   "id": "6132abeaf6f1",
   "name": "qrToDataURL / qrToString",
   "kind": "near",
   "isComponent": false,
   "members": [
    {
     "id": "src/lib/qr.ts#qrToDataURL#14",
     "name": "qrToDataURL",
     "path": "src/lib/qr.ts",
     "line": 14,
     "endLine": 20,
     "lines": 7,
     "declKind": "function",
     "exported": true,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/lib/qr.ts#qrToString#22",
     "name": "qrToString",
     "path": "src/lib/qr.ts",
     "line": 22,
     "endLine": 28,
     "lines": 7,
     "declKind": "function",
     "exported": true,
     "isDefault": false,
     "variant": 1
    }
   ],
   "duplicateLines": 7,
   "mergeable": false,
   "reason": "these copies differ; the agent can write one shared version"
  },
  {
   "id": "ec8c254d4745",
   "name": "isRateLimited / isForbidden",
   "kind": "near",
   "isComponent": false,
   "members": [
    {
     "id": "src/routes/lovable/email/queue/process.ts#isRateLimited#14",
     "name": "isRateLimited",
     "path": "src/routes/lovable/email/queue/process.ts",
     "line": 14,
     "endLine": 19,
     "lines": 6,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/routes/lovable/email/queue/process.ts#isForbidden#23",
     "name": "isForbidden",
     "path": "src/routes/lovable/email/queue/process.ts",
     "line": 23,
     "endLine": 28,
     "lines": 6,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 1
    }
   ],
   "duplicateLines": 6,
   "mergeable": false,
   "reason": "these copies differ; the agent can write one shared version"
  },
  {
   "id": "044ac66442d8",
   "name": "unsubscribeUrl / openPixelUrl",
   "kind": "near",
   "isComponent": false,
   "members": [
    {
     "id": "src/lib/email-campaigns.server.ts#unsubscribeUrl#39",
     "name": "unsubscribeUrl",
     "path": "src/lib/email-campaigns.server.ts",
     "line": 39,
     "endLine": 42,
     "lines": 4,
     "declKind": "function",
     "exported": true,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/lib/email-campaigns.server.ts#openPixelUrl#44",
     "name": "openPixelUrl",
     "path": "src/lib/email-campaigns.server.ts",
     "line": 44,
     "endLine": 47,
     "lines": 4,
     "declKind": "function",
     "exported": true,
     "isDefault": false,
     "variant": 1
    }
   ],
   "duplicateLines": 4,
   "mergeable": false,
   "reason": "these copies differ; the agent can write one shared version"
  },
  {
   "id": "f19add3e8d51",
   "name": "component",
   "kind": "exact",
   "isComponent": false,
   "members": [
    {
     "id": "src/lib/geo.server.ts#component#66",
     "name": "component",
     "path": "src/lib/geo.server.ts",
     "line": 66,
     "endLine": 69,
     "lines": 4,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    },
    {
     "id": "src/lib/places.server.ts#component#33",
     "name": "component",
     "path": "src/lib/places.server.ts",
     "line": 33,
     "endLine": 36,
     "lines": 4,
     "declKind": "function",
     "exported": false,
     "isDefault": false,
     "variant": 0
    }
   ],
   "duplicateLines": 4,
   "mergeable": true
  }
 ],
 "baseline": {
  "errors": 0,
  "coverage": {
   "covered": 159,
   "total": 159,
   "ratio": 1
  },
  "build": {
   "ran": true,
   "ok": true,
   "ms": 41200
  }
 },
 "merges": [],
 "metrics": {
  "duplicateLinesStart": 59,
  "duplicateLinesNow": 59,
  "kept": 0,
  "refused": 0
 }
};

export const fixtureSources: Record<string, string> = {
 "src/integrations/supabase/auth-middleware.ts#createSupabaseFetch#13": "function createSupabaseFetch(supabaseKey: string): typeof fetch {\r\n  return (input, init) => {\r\n    const headers = new Headers(\r\n      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,\r\n    );\r\n\r\n    if (init?.headers) {\r\n      new Headers(init.headers).forEach((value, key) => headers.set(key, value));\r\n    }\r\n\r\n    // New Supabase API keys are opaque strings, not bearer JWTs.\r\n    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {\r\n      headers.delete('Authorization');\r\n    }\r\n\r\n    headers.set('apikey', supabaseKey);\r\n    return fetch(input, { ...init, headers });\r\n  };\r\n}",
 "src/integrations/supabase/client.server.ts#createSupabaseFetch#12": "function createSupabaseFetch(supabaseKey: string): typeof fetch {\r\n  return (input, init) => {\r\n    const headers = new Headers(\r\n      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,\r\n    );\r\n\r\n    if (init?.headers) {\r\n      new Headers(init.headers).forEach((value, key) => headers.set(key, value));\r\n    }\r\n\r\n    // New Supabase API keys are opaque strings, not bearer JWTs.\r\n    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {\r\n      headers.delete('Authorization');\r\n    }\r\n\r\n    headers.set('apikey', supabaseKey);\r\n    return fetch(input, { ...init, headers });\r\n  };\r\n}",
 "src/integrations/supabase/client.ts#createSupabaseFetch#10": "function createSupabaseFetch(supabaseKey: string): typeof fetch {\r\n  return (input, init) => {\r\n    const headers = new Headers(\r\n      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,\r\n    );\r\n\r\n    if (init?.headers) {\r\n      new Headers(init.headers).forEach((value, key) => headers.set(key, value));\r\n    }\r\n\r\n    // New Supabase API keys are opaque strings, not bearer JWTs.\r\n    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {\r\n      headers.delete('Authorization');\r\n    }\r\n\r\n    headers.set('apikey', supabaseKey);\r\n    return fetch(input, { ...init, headers });\r\n  };\r\n}",
 "src/lib/qr.ts#qrToDataURL#14": "export async function qrToDataURL(\r\n  text: string,\r\n  options?: QRCode.QRCodeToDataURLOptions,\r\n): Promise<string> {\r\n  const qr = await getQrModule();\r\n  return qr.toDataURL(text, options);\r\n}",
 "src/lib/qr.ts#qrToString#22": "export async function qrToString(\r\n  text: string,\r\n  options?: QRCode.QRCodeToStringOptions,\r\n): Promise<string> {\r\n  const qr = await getQrModule();\r\n  return qr.toString(text, options);\r\n}",
 "src/routes/lovable/email/queue/process.ts#isRateLimited#14": "function isRateLimited(error: unknown): boolean {\r\n  if (error && typeof error === 'object' && 'status' in error) {\r\n    return (error as { status: number }).status === 429\r\n  }\r\n  return error instanceof Error && error.message.includes('429')\r\n}",
 "src/routes/lovable/email/queue/process.ts#isForbidden#23": "function isForbidden(error: unknown): boolean {\r\n  if (error && typeof error === 'object' && 'status' in error) {\r\n    return (error as { status: number }).status === 403\r\n  }\r\n  return error instanceof Error && error.message.includes('403')\r\n}",
 "src/lib/email-campaigns.server.ts#unsubscribeUrl#39": "export function unsubscribeUrl(recipientId: string): string {\r\n  const q = new URLSearchParams({ r: recipientId, s: signLink(recipientId, \"unsubscribe\") });\r\n  return `${baseUrl()}/api/public/e/unsubscribe?${q.toString()}`;\r\n}",
 "src/lib/email-campaigns.server.ts#openPixelUrl#44": "export function openPixelUrl(recipientId: string): string {\r\n  const q = new URLSearchParams({ r: recipientId, s: signLink(recipientId, \"open\") });\r\n  return `${baseUrl()}/api/public/e/open?${q.toString()}`;\r\n}",
 "src/lib/geo.server.ts#component#66": "function component(components: AddressComponent[], type: string, short = false): string {\r\n  const c = components.find((x) => x.types?.includes(type));\r\n  return (short ? c?.shortText : c?.longText) ?? \"\";\r\n}",
 "src/lib/places.server.ts#component#33": "function component(components: AddressComponent[], type: string, short = false): string {\r\n  const c = components.find((x) => x.types?.includes(type));\r\n  return (short ? c?.shortText : c?.longText) ?? \"\";\r\n}"
};
