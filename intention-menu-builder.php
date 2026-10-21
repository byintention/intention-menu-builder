<?php

declare(strict_types=1);

namespace Grav\Plugin;

use Composer\Autoload\ClassLoader;
use Grav\Common\Plugin;
use Grav\Events\PermissionsRegisterEvent;
use Grav\Framework\Acl\PermissionsReader;
use Grav\Plugin\IntentionMenuBuilder\TwigExtension as IntentionMenuBuilderTwigExtension;
use RocketTheme\Toolbox\Event\Event;

class IntentionMenuBuilderPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return [
            'onTwigTemplatePaths' => ['onTwigTemplatePaths', 0],
            'onTwigExtensions' => ['onTwigExtensions', 0],
            'onApiRegisterRoutes' => ['onApiRegisterRoutes', 0],
            'onApiSidebarItems' => ['onApiSidebarItems', 0],
            'onApiPluginPageInfo' => ['onApiPluginPageInfo', 0],
            PermissionsRegisterEvent::class => ['onRegisterPermissions', 0],
        ];
    }

    public function autoload(): ClassLoader
    {
        $loader = new ClassLoader();
        $loader->addPsr4('Grav\\Plugin\\IntentionMenuBuilder\\', __DIR__ . '/classes');
        $loader->register();

        return $loader;
    }

    public function onTwigTemplatePaths(): void
    {
        $this->grav['twig']->twig_paths[] = __DIR__ . '/templates';
    }

    public function onTwigExtensions(): void
    {
        $this->grav['twig']->twig->addExtension(new IntentionMenuBuilderTwigExtension());
    }

    public function onApiRegisterRoutes(Event $event): void
    {
        $routes = $event['routes'];
        $controller = \Grav\Plugin\IntentionMenuBuilder\Api\IntentionMenuBuilderApiController::class;

        $routes->get('/intention-menu-builder/config', [$controller, 'config']);
        $routes->get('/intention-menu-builder/pages', [$controller, 'pages']);
        $routes->get('/intention-menu-builder/menus', [$controller, 'index']);
        $routes->post('/intention-menu-builder/menus', [$controller, 'create']);
        $routes->get('/intention-menu-builder/menus/{id}', [$controller, 'show']);
        $routes->patch('/intention-menu-builder/menus/{id}', [$controller, 'update']);
        $routes->delete('/intention-menu-builder/menus/{id}', [$controller, 'delete']);
    }

    public function onApiSidebarItems(Event $event): void
    {
        if (!$this->config->get('plugins.intention-menu-builder.enabled', true)) {
            return;
        }

        $items = $event['items'] ?? [];
        $items[] = [
            'id' => 'intention-menu-builder',
            'plugin' => 'intention-menu-builder',
            'label' => 'PLUGIN_INTENTION_MENU_BUILDER.SIDEBAR',
            'icon' => 'fa-bars',
            'route' => '/plugin/intention-menu-builder',
            'priority' => 26,
            'authorize' => 'admin.intention-menu-builder.read',
        ];
        $event['items'] = $items;
    }

    public function onApiPluginPageInfo(Event $event): void
    {
        if (($event['plugin'] ?? null) !== 'intention-menu-builder') {
            return;
        }

        $event['definition'] = [
            'id' => 'intention-menu-builder',
            'plugin' => 'intention-menu-builder',
            'title' => $this->grav['language']->translate('PLUGIN_INTENTION_MENU_BUILDER.TITLE'),
            'icon' => 'fa-bars',
            'page_type' => 'component',
        ];
    }

    public function onRegisterPermissions(PermissionsRegisterEvent $event): void
    {
        $permissions = $event->permissions;
        $permissions->addActions(
            PermissionsReader::fromYaml("plugin://{$this->name}/permissions.yaml")
        );
    }
}
