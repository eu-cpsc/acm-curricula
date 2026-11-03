# Cloudflare Pages + Access

Hosts the planner on Cloudflare Pages behind Cloudflare Access. Visitors must
sign in with an allowed email address (they're emailed a one-time code).
Access protects the production URL, every preview/branch URL, and the custom
domain if one is set.

## One-time manual steps (not manageable in Terraform)

1. **Zero Trust**: in the Cloudflare dashboard, open *Zero Trust* and finish
   onboarding (pick a team name, choose the Free plan, which covers up to 50 users).
2. **GitHub app**: in *Workers & Pages → Create → Pages → Connect to Git*,
   install the Cloudflare Pages GitHub app on the `eu-cpsc` org and give it
   access to `acm-curricula`. You can cancel after the app is installed;
   Terraform creates the project itself.
3. **API token** with account permissions *Cloudflare Pages: Edit*,
   *Access: Apps and Policies: Edit*, *Access: Organizations, Identity
   Providers, and Groups: Edit* (and *Zone → DNS: Edit* if you use a custom domain).

## Apply

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in account_id and allowed emails
export CLOUDFLARE_API_TOKEN=...
terraform init
terraform apply
```

If the account already has an email one-time PIN login method, `apply` fails
creating it. In that case set `create_otp_identity_provider = false` and
`otp_identity_provider_id` to the existing ID.

After the first apply, Pages builds from `main` on every push. Once you're
happy with it, delete `.github/workflows/pages.yml` so the app isn't also
published publicly on GitHub Pages.
