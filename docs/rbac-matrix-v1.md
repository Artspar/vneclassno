# RBAC Matrix v1

| Permission | super_admin | section_admin | coach | parent |
|---|---|---|---|---|
| sessions:read | yes | yes | yes (assigned sections) | yes (own children) |
| sessions:write | yes | yes | no | no |
| attendance:write | yes | yes | yes (assigned groups) | no |
| absence:request | yes | yes | yes | yes |
| absence:decide | yes | yes | yes (assigned groups) | no |
| subscriptions:read | yes | yes | yes (assigned sections) | yes (own children) |
| subscriptions:write | yes | yes | no | no |
| payments:create | yes | yes | yes | yes |
| payments:manual_confirm | yes | yes | yes (assigned sections) | no |
| notifications:send | yes | yes | yes (assigned sections) | no |
| context:select | yes | yes | yes | yes |
| admin:manage_section | yes | yes | no | no |
| admin:manage_platform | yes | no | no | no |

## Notes

- `super_admin` bypasses section scope checks.
- `section_admin` rights are limited to own section.
- `coach` rights are limited to assigned groups/section.
- `parent` rights are limited to linked children and their sections.
