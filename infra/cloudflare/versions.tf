terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }
}

# Auth: export CLOUDFLARE_API_TOKEN. The token needs these account permissions:
#   Cloudflare Pages: Edit
#   Access: Apps and Policies: Edit
#   Access: Organizations, Identity Providers, and Groups: Edit
# plus Zone > DNS: Edit on the zone if you set custom_domain.
provider "cloudflare" {}
