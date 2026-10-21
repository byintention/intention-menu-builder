<?php

declare(strict_types=1);

namespace Grav\Plugin\IntentionMenuBuilder;

use Grav\Common\Grav;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class TwigExtension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('menu_items', [$this, 'menuItems']),
            new TwigFunction('menu_render', [$this, 'menuRender'], [
                'is_safe' => ['html'],
            ]),
        ];
    }

    /**
     * @param array<string, mixed> $options
     * @return list<array<string, mixed>>
     */
    public function menuItems(string $id, array $options = []): array
    {
        unset($options);
        $grav = Grav::instance();
        $menu = (new MenuRepository($grav))->find($id);
        if ($menu === null) {
            return [];
        }

        $items = $menu['items'] ?? [];
        if (!is_array($items)) {
            return [];
        }

        /** @var list<array<string, mixed>> $items */
        return (new MenuResolver($grav))->resolve($items);
    }

    /**
     * @param array<string, mixed> $options
     */
    public function menuRender(string $id, array $options = []): string
    {
        $grav = Grav::instance();
        $vars = array_merge([
            'menu_id' => $id,
            'items' => $this->menuItems($id),
            'wrap_nav' => true,
            'nav_id' => '',
            'nav_class' => 'clearfix',
            'ul_id' => '',
            'ul_class' => '',
        ], $options);

        return $grav['twig']->processTemplate('partials/menu.html.twig', $vars);
    }
}
