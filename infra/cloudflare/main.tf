locals {
  pages_host = "${var.project_name}.pages.dev"

  # Everything Access must protect: production, every preview/branch
  # deployment (*.project.pages.dev), and the custom domain if any.
  protected_hosts = concat(
    [local.pages_host, "*.${local.pages_host}"],
    var.custom_domain == "" ? [] : [var.custom_domain],
  )

  otp_idp_id = var.create_otp_identity_provider ? cloudflare_zero_trust_access_identity_provider.otp[0].id : var.otp_identity_provider_id
}

# ------------------------------------------------------------------ Pages site

# Requires the Cloudflare Pages GitHub app to be installed on the GitHub org
# with access to this repo (one-time, from the Cloudflare dashboard).
resource "cloudflare_pages_project" "site" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = {
    build_command   = "npm ci && npm run build"
    destination_dir = "dist"
    root_dir        = ""
  }

  source = {
    type = "github"
    config = {
      owner                          = var.github_owner
      repo_name                      = var.github_repo
      production_branch              = var.production_branch
      production_deployments_enabled = true
      pr_comments_enabled            = true
      preview_deployment_setting     = "all"
    }
  }

  deployment_configs = {
    production = {
      env_vars = {
        NODE_VERSION = { type = "plain_text", value = "22" }
      }
    }
    preview = {
      env_vars = {
        NODE_VERSION = { type = "plain_text", value = "22" }
      }
    }
  }
}

resource "cloudflare_pages_domain" "custom" {
  count        = var.custom_domain == "" ? 0 : 1
  account_id   = var.account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.custom_domain
}

resource "cloudflare_dns_record" "custom" {
  count   = var.custom_domain == "" ? 0 : 1
  zone_id = var.zone_id
  name    = var.custom_domain
  type    = "CNAME"
  content = local.pages_host
  proxied = true
  ttl     = 1
}

# ---------------------------------------------------------- Access (sign-in)

# Email one-time PIN: users enter their email and get a code. No SSO setup needed.
resource "cloudflare_zero_trust_access_identity_provider" "otp" {
  count      = var.create_otp_identity_provider ? 1 : 0
  account_id = var.account_id
  name       = "Email one-time PIN"
  type       = "onetimepin"
  config     = {}
}

resource "cloudflare_zero_trust_access_policy" "allow" {
  account_id = var.account_id
  name       = "${var.project_name} - allowed users"
  decision   = "allow"

  include = concat(
    [for d in var.allowed_email_domains : { email_domain = { domain = d } }],
    [for e in var.allowed_emails : { email = { email = e } }],
  )

  lifecycle {
    precondition {
      condition     = length(var.allowed_email_domains) + length(var.allowed_emails) > 0
      error_message = "Set allowed_email_domains and/or allowed_emails, or nobody can sign in."
    }
  }
}

resource "cloudflare_zero_trust_access_application" "site" {
  account_id       = var.account_id
  name             = "ACM Curriculum Planner"
  type             = "self_hosted"
  domain           = var.custom_domain == "" ? local.pages_host : var.custom_domain
  session_duration = var.session_duration

  destinations = [for h in local.protected_hosts : { type = "public", uri = h }]

  allowed_idps              = [local.otp_idp_id]
  auto_redirect_to_identity = true
  app_launcher_visible      = false

  policies = [{
    id         = cloudflare_zero_trust_access_policy.allow.id
    precedence = 1
  }]
}
