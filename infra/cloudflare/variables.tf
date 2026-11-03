variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "project_name" {
  description = "Pages project name. The site is served at <project_name>.pages.dev."
  type        = string
  default     = "acm-curricula"
}

variable "github_owner" {
  description = "GitHub org or user that owns the repo."
  type        = string
  default     = "eu-cpsc"
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "acm-curricula"
}

variable "production_branch" {
  type    = string
  default = "main"
}

variable "allowed_email_domains" {
  description = "Anyone with an email address at these domains can sign in, e.g. [\"evangel.edu\"]."
  type        = list(string)
  default     = []
}

variable "allowed_emails" {
  description = "Individual email addresses allowed to sign in."
  type        = list(string)
  default     = []
}

variable "create_otp_identity_provider" {
  description = "Create the one-time PIN (email code) login method. Set false if the account already has one and pass its ID in otp_identity_provider_id."
  type        = bool
  default     = true
}

variable "otp_identity_provider_id" {
  description = "Existing one-time PIN identity provider ID (only used when create_otp_identity_provider = false)."
  type        = string
  default     = ""
}

variable "session_duration" {
  description = "How long a sign-in lasts before asking again."
  type        = string
  default     = "168h"
}

variable "custom_domain" {
  description = "Optional custom hostname, e.g. \"curriculum.example.edu\". Leave empty to use only pages.dev. The zone must be on Cloudflare."
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "Zone ID for custom_domain (required only when custom_domain is set)."
  type        = string
  default     = ""
}
