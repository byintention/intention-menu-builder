<?php

declare(strict_types=1);

namespace Grav\Plugin\IntentionMenuBuilder;

use Grav\Common\Grav;
use Grav\Common\Page\Interfaces\PageInterface;

class MenuResolver
{
    public function __construct(private readonly Grav $grav)
    {
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return list<array<string, mixed>>
     */
    public function resolve(array $items): array
    {
        $out = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $resolved = $this->resolveItem($item);
            $children = [];
            if (isset($item['children']) && is_array($item['children'])) {
                foreach ($item['children'] as $child) {
                    if (is_array($child)) {
                        $children[] = $this->resolveItem($child);
                    }
                }
            }
            $resolved['children'] = $children;
            if (!$resolved['active'] && $children !== []) {
                foreach ($children as $child) {
                    if (!empty($child['active'])) {
                        $resolved['active_child'] = true;
                        break;
                    }
                }
            }
            $out[] = $resolved;
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $item
     * @return array<string, mixed>
     */
    private function resolveItem(array $item): array
    {
        $type = (string) ($item['type'] ?? 'internal');
        $external = $type === 'external';
        $title = trim((string) ($item['title'] ?? ''));
        $classes = trim((string) ($item['classes'] ?? ''));
        $newTab = (bool) ($item['new_tab'] ?? $external);
        $missing = false;
        $active = false;
        $activeChild = false;
        $url = '';

        if ($external) {
            $url = $this->absoluteUrl(trim((string) ($item['url'] ?? '')));
            if ($title === '') {
                $title = $url !== '' ? $url : 'Link';
            }
            $active = $this->urlIsCurrent($url);
        } else {
            $route = trim((string) ($item['page'] ?? ''));
            $page = $route !== '' ? $this->findPage($route) : null;
            if ($page instanceof PageInterface) {
                $url = $this->absoluteUrl((string) $page->url(true));
                if ($title === '') {
                    $title = (string) ($page->menu() ?: $page->title());
                }
                $active = (bool) $page->active();
                $activeChild = (bool) $page->activeChild();
            } else {
                $missing = true;
                $url = '#';
                if ($title === '') {
                    $title = $route !== '' ? $route : 'Missing page';
                }
            }
        }

        return [
            'title' => $title,
            'url' => $url,
            'classes' => $classes,
            'active' => $active,
            'active_child' => $activeChild,
            'external' => $external,
            'new_tab' => $newTab,
            'missing' => $missing,
            'children' => [],
        ];
    }

    private function findPage(string $route): ?PageInterface
    {
        $pages = $this->grav['pages'];
        $page = $pages->find($route);
        if ($page instanceof PageInterface) {
            return $page;
        }

        if ($route === '/' || $route === '') {
            $home = $pages->find('/');
            return $home instanceof PageInterface ? $home : null;
        }

        return null;
    }

    private function absoluteUrl(string $url): string
    {
        if ($url === '' || $url === '#' || str_starts_with($url, 'mailto:') || str_starts_with($url, 'tel:')) {
            return $url;
        }

        if (str_starts_with($url, '//') || str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        $root = rtrim((string) $this->grav['uri']->rootUrl(true), '/');
        if ($url === '/') {
            return $root !== '' ? $root . '/' : '/';
        }

        if (str_starts_with($url, '/')) {
            return $root . $url;
        }

        return $url;
    }

    private function urlIsCurrent(string $url): bool
    {
        if ($url === '' || str_starts_with($url, 'mailto:') || str_starts_with($url, 'tel:')) {
            return false;
        }

        $page = $this->grav['page'] ?? null;
        if (!$page instanceof PageInterface) {
            return false;
        }

        $currentUrl = (string) $page->url(true);
        $currentHost = parse_url($currentUrl, PHP_URL_HOST);
        $targetHost = parse_url($url, PHP_URL_HOST);
        if (is_string($targetHost) && $targetHost !== '' && is_string($currentHost) && strcasecmp($targetHost, $currentHost) !== 0) {
            return false;
        }

        $currentPath = parse_url($currentUrl, PHP_URL_PATH);
        $targetPath = parse_url($url, PHP_URL_PATH);
        if (!is_string($currentPath) || $currentPath === '') {
            $currentPath = '/';
        }
        if (!is_string($targetPath) || $targetPath === '') {
            $targetPath = str_starts_with($url, '/') ? $url : '/';
        }

        $current = rtrim($currentPath, '/') ?: '/';
        $target = rtrim($targetPath, '/') ?: '/';

        return $current === $target;
    }

}
