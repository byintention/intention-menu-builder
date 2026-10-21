<?php

declare(strict_types=1);

namespace Grav\Plugin\IntentionMenuBuilder\Api;

use Grav\Common\Page\Interfaces\PageInterface;
use Grav\Plugin\Api\AdminProxy;
use Grav\Plugin\Api\Controllers\AbstractApiController;
use Grav\Plugin\Api\Exceptions\NotFoundException;
use Grav\Plugin\Api\Exceptions\ValidationException;
use Grav\Plugin\Api\Response\ApiResponse;
use Grav\Plugin\IntentionMenuBuilder\MenuRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class IntentionMenuBuilderApiController extends AbstractApiController
{
    /**
     * GET /intention-menu-builder/config
     */
    public function config(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.read');

        return ApiResponse::create([
            'enabled' => (bool) $this->config->get('plugins.intention-menu-builder.enabled', true),
        ]);
    }

    /**
     * GET /intention-menu-builder/pages
     */
    public function pages(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'api.pages.read');

        AdminProxy::enablePages();
        $pages = $this->grav['pages'];

        $list = [];
        foreach ($pages->instances() as $page) {
            if (!$page instanceof PageInterface) {
                continue;
            }
            $route = (string) $page->route();
            if ($route === '') {
                $route = '/';
            }
            if ($this->isInsightsChildRoute($route)) {
                continue;
            }
            $list[] = [
                'route' => $route,
                'title' => (string) $page->title(),
                'menu' => (string) ($page->menu() ?: $page->title()),
                'published' => (bool) $page->published(),
                'visible' => (bool) $page->visible(),
            ];
        }

        usort($list, static fn (array $a, array $b): int => strcasecmp($a['route'], $b['route']));

        return ApiResponse::create($list);
    }

    /**
     * GET /intention-menu-builder/menus
     */
    public function index(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.read');

        return ApiResponse::create($this->repository()->summaries());
    }

    /**
     * POST /intention-menu-builder/menus
     */
    public function create(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.write');

        $body = $this->getRequestBody($request);
        $this->requireFields($body, ['id']);

        $menu = $this->repository()->create($body);

        return ApiResponse::created($menu, $this->getApiBaseUrl() . '/intention-menu-builder/menus/' . $menu['id']);
    }

    /**
     * GET /intention-menu-builder/menus/{id}
     */
    public function show(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.read');

        $id = $this->menuId($request);
        $menu = $this->repository()->find($id);
        if ($menu === null) {
            throw new NotFoundException("Menu '{$id}' was not found.");
        }

        return ApiResponse::create($menu);
    }

    /**
     * PATCH /intention-menu-builder/menus/{id}
     */
    public function update(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.write');

        $id = $this->menuId($request);
        $body = $this->getRequestBody($request);
        $menu = $this->repository()->update($id, $body);

        return ApiResponse::create($menu);
    }

    /**
     * DELETE /intention-menu-builder/menus/{id}
     */
    public function delete(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, 'admin.intention-menu-builder.write');

        $this->repository()->delete($this->menuId($request));

        return ApiResponse::noContent();
    }

    private function repository(): MenuRepository
    {
        return new MenuRepository($this->grav);
    }

    private function menuId(ServerRequestInterface $request): string
    {
        $id = strtolower(trim((string) $this->getRouteParam($request, 'id')));
        if ($id === '') {
            throw new ValidationException('Menu ID is required.', [
                ['field' => 'id', 'message' => 'Required'],
            ]);
        }

        return $id;
    }

    /**
     * Blog posts under /insights clutter the page picker; keep the listing page itself.
     */
    private function isInsightsChildRoute(string $route): bool
    {
        return str_starts_with($route, '/insights/');
    }
}
