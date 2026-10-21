# Intention Menu Builder — agent guide

Grav **2.x** Admin Next named-menu plugin. Workspace root is this directory only.

## Scope

- Edit **only** files under this plugin tree.
- Do **not** change `user/config/`, `user/pages/`, themes, other plugins, or parent Grav site `.cursor/`.
- Plugin enablement, site config, and menu data under `user/data/`: **describe steps for the user**; do not apply them here.

See [`.cursor/rules/scope-intention-menu-builder.mdc`](.cursor/rules/scope-intention-menu-builder.mdc).

## Skills

Before implementation that touches API routes, Admin2, or `admin-next/`, read [`.cursor/skills/`](.cursor/skills/) and follow the matching skill:

| Task | Skill |
|------|--------|
| REST API only | `grav-api-integration.md` |
| Admin2 / `onApi*` / `admin-next/` / widgets / plugin pages | `grav-api-admin-next-integration.md` |

## What this plugin does

Named navigation menus with:

- Admin Next sidebar + list/edit page
- Multiple menus, each with a unique ID used in Twig
- Items: internal Grav page or external URL
- Custom display name and classes (applied to the `<li>`)
- Drag reorder and one level of nesting (Nest / Un-nest)
- Twig `menu_render()` and `menu_items()`
- Default markup in `templates/partials/menu.html.twig` (themes may override the partial)

Menu IDs cannot be renamed after create. Runtime data path (not in this repo): `user/data/intention-menu-builder/{id}.yaml`.

## Layout

| Path | Role |
|------|------|
| [`intention-menu-builder.php`](intention-menu-builder.php) | Events: Twig, API routes, sidebar, plugin page, permissions |
| [`classes/MenuRepository.php`](classes/MenuRepository.php) | YAML persistence and item sanitizing |
| [`classes/MenuResolver.php`](classes/MenuResolver.php) | Resolve pages and URLs for render |
| [`classes/TwigExtension.php`](classes/TwigExtension.php) | `menu_items` / `menu_render` |
| [`classes/Api/IntentionMenuBuilderApiController.php`](classes/Api/IntentionMenuBuilderApiController.php) | CRUD + config + page list |
| [`admin-next/pages/intention-menu-builder.js`](admin-next/pages/intention-menu-builder.js) | List/edit UI |
| [`assets/css/intention-menu-builder-admin.css`](assets/css/intention-menu-builder-admin.css) | Admin styles |
| [`templates/partials/menu.html.twig`](templates/partials/menu.html.twig) | Default front-end markup |

## Conventions

See [`.cursor/rules/conventions.mdc`](.cursor/rules/conventions.mdc). Class prefix: `imb-admin-*`. No native `confirm()` in Admin Next — use `__GRAV_DIALOGS`.

## Changelog

After completing a task, prepend two lines to [`.cursor/notes/changelog.md`](.cursor/notes/changelog.md) (date + ≤30-word summary). Do **not** write to the parent Grav site changelog.

## Out of scope here

Site plugin enablement (`user/config/plugins/intention-menu-builder.yaml`), menu YAML under `user/data/`, and theme overrides of `partials/menu.html.twig` belong in the **Grav site** workspace or Admin UI — not this repo.
