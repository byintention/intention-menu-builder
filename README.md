# Intention Menu Builder

Named navigation menus for Grav 2 Admin2. Create multiple menus with unique IDs, then insert them in Twig.

## Templates

```twig
{{ menu_render('header') }}
{{ menu_render('footer', { ul_id: 'menu-footer-4', ul_class: 'menu' }) }}

{% for item in menu_items('header') %}
  <a href="{{ item.url }}">{{ item.title }}</a>
{% endfor %}
```

`menu_render()` options: `wrap_nav` (default true), `nav_id`, `nav_class`, `ul_id`, `ul_class`. Internal links use the full site URL (scheme + host + path).

Override markup by copying `templates/partials/menu.html.twig` into the active theme.

## Admin

Open **Menus** in the Admin2 sidebar. Each item can be:

- **Internal** — pick a Grav page
- **External** — URL field
- Custom **display name** and **classes** (applied to the `<li>`)
- Drag-reordered with the `⋮⋮` handle (same pattern as Badger Builder)
- Nested one level (Nest / Un-nest)

Menu IDs cannot be renamed after create. Storage: `user/data/intention-menu-builder/{id}.yaml`.
