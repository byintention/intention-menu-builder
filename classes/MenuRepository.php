<?php

declare(strict_types=1);

namespace Grav\Plugin\IntentionMenuBuilder;

use Grav\Common\Grav;
use Grav\Plugin\Api\Exceptions\ConflictException;
use Grav\Plugin\Api\Exceptions\NotFoundException;
use Grav\Plugin\Api\Exceptions\ValidationException;
use RocketTheme\Toolbox\File\YamlFile;

class MenuRepository
{
    public const ID_PATTERN = '/^[a-z][a-z0-9-]{0,62}$/';

    public function __construct(private readonly Grav $grav)
    {
    }

    /**
     * @return list<array{id: string, label: string, item_count: int}>
     */
    public function summaries(): array
    {
        $out = [];
        foreach ($this->ids() as $id) {
            $menu = $this->find($id);
            if ($menu === null) {
                continue;
            }
            $out[] = [
                'id' => $id,
                'label' => (string) ($menu['label'] ?? $id),
                'item_count' => $this->countItems($menu['items'] ?? []),
            ];
        }

        usort($out, static fn (array $a, array $b): int => strcasecmp($a['id'], $b['id']));

        return $out;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        if (!$this->isValidId($id)) {
            return null;
        }

        $path = $this->filePath($id);
        if (!is_file($path)) {
            return null;
        }

        $file = YamlFile::instance($path);
        $data = $file->content();

        if (!is_array($data) || $data === []) {
            return null;
        }

        $data['id'] = $id;
        $data['label'] = (string) ($data['label'] ?? $id);
        $data['items'] = is_array($data['items'] ?? null) ? $data['items'] : [];

        return $data;
    }

    /**
     * @param array<string, mixed> $menu
     * @return array<string, mixed>
     */
    public function create(array $menu): array
    {
        $id = $this->normalizeId((string) ($menu['id'] ?? ''));
        $this->assertId($id);

        if (is_file($this->filePath($id))) {
            throw new ConflictException("Menu '{$id}' already exists.");
        }

        $record = [
            'id' => $id,
            'label' => trim((string) ($menu['label'] ?? $id)) ?: $id,
            'updated' => $this->now(),
            'items' => $this->sanitizeItems($menu['items'] ?? [], 0),
        ];

        $this->write($id, $record);

        return $record;
    }

    /**
     * @param array<string, mixed> $menu
     * @return array<string, mixed>
     */
    public function update(string $id, array $menu): array
    {
        $id = $this->normalizeId($id);
        $this->assertId($id);

        $existing = $this->find($id);
        if ($existing === null) {
            throw new NotFoundException("Menu '{$id}' was not found.");
        }

        $record = [
            'id' => $id,
            'label' => trim((string) ($menu['label'] ?? $existing['label'] ?? $id)) ?: $id,
            'updated' => $this->now(),
            'items' => $this->sanitizeItems($menu['items'] ?? [], 0),
        ];

        $this->write($id, $record);

        return $record;
    }

    public function delete(string $id): void
    {
        $id = $this->normalizeId($id);
        $this->assertId($id);

        $path = $this->filePath($id);
        if (!is_file($path)) {
            throw new NotFoundException("Menu '{$id}' was not found.");
        }

        if (!@unlink($path)) {
            throw new ValidationException("Could not delete menu '{$id}'.");
        }
    }

    public function isValidId(string $id): bool
    {
        return (bool) preg_match(self::ID_PATTERN, $id);
    }

    /**
     * @return list<string>
     */
    private function ids(): array
    {
        $dir = $this->directory();
        if (!is_dir($dir)) {
            return [];
        }

        $ids = [];
        foreach (glob($dir . '/*.yaml') ?: [] as $file) {
            $id = basename($file, '.yaml');
            if ($this->isValidId($id)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    private function directory(): string
    {
        $locator = $this->grav['locator'];
        $data = $locator->findResource('user://data', true, true);
        if (!is_string($data) || $data === '') {
            $data = rtrim((string) USER_DIR, '/') . '/data';
        }

        $dir = $data . '/intention-menu-builder';
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new ValidationException('Could not create menu data directory.');
        }

        return $dir;
    }

    private function filePath(string $id): string
    {
        return $this->directory() . '/' . $id . '.yaml';
    }

    /**
     * @param array<string, mixed> $record
     */
    private function write(string $id, array $record): void
    {
        $file = YamlFile::instance($this->filePath($id));
        $file->content($record);
        $file->save();

        $this->grav['cache']->clearCache('standard');
    }

    private function normalizeId(string $id): string
    {
        return strtolower(trim($id));
    }

    private function assertId(string $id): void
    {
        if (!$this->isValidId($id)) {
            throw new ValidationException(
                'Menu ID must start with a letter and use only lowercase letters, numbers, and hyphens.',
                [['field' => 'id', 'message' => 'Invalid menu ID']]
            );
        }
    }

    /**
     * @param mixed $items
     * @return list<array<string, mixed>>
     */
    private function sanitizeItems(mixed $items, int $depth): array
    {
        if ($depth > 1) {
            throw new ValidationException('Menus support one level of child items.');
        }

        if (!is_array($items)) {
            return [];
        }

        $out = [];
        $seen = [];

        foreach ($items as $raw) {
            if (!is_array($raw)) {
                continue;
            }

            $itemId = trim((string) ($raw['id'] ?? ''));
            if ($itemId === '' || isset($seen[$itemId])) {
                $itemId = bin2hex(random_bytes(6));
            }
            $seen[$itemId] = true;

            $type = (string) ($raw['type'] ?? 'internal');
            if ($type !== 'external') {
                $type = 'internal';
            }

            $page = trim((string) ($raw['page'] ?? ''));
            $url = trim((string) ($raw['url'] ?? ''));
            if ($type === 'internal') {
                $url = '';
                if ($page !== '' && !str_starts_with($page, '/')) {
                    $page = '/' . ltrim($page, '/');
                }
            } else {
                $page = '';
            }

            $classes = preg_replace('/[^A-Za-z0-9_\- ]+/', '', (string) ($raw['classes'] ?? '')) ?? '';
            $classes = trim(preg_replace('/\s+/', ' ', $classes) ?? '');

            $children = [];
            if ($depth === 0) {
                $children = $this->sanitizeItems($raw['children'] ?? [], $depth + 1);
            }

            $out[] = [
                'id' => $itemId,
                'type' => $type,
                'page' => $page,
                'url' => $url,
                'title' => trim((string) ($raw['title'] ?? '')),
                'classes' => $classes,
                'new_tab' => (bool) ($raw['new_tab'] ?? ($type === 'external')),
                'children' => $children,
            ];
        }

        return $out;
    }

    /**
     * @param mixed $items
     */
    private function countItems(mixed $items): int
    {
        if (!is_array($items)) {
            return 0;
        }

        $n = 0;
        foreach ($items as $item) {
            $n++;
            if (is_array($item) && isset($item['children']) && is_array($item['children'])) {
                $n += count($item['children']);
            }
        }

        return $n;
    }

    private function now(): string
    {
        return (new \DateTimeImmutable('now'))->format(\DateTimeInterface::ATOM);
    }
}
