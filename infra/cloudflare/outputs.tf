output "pages_url" {
  value = "https://${cloudflare_pages_project.site.subdomain}"
}

output "custom_url" {
  value = var.custom_domain == "" ? null : "https://${var.custom_domain}"
}
