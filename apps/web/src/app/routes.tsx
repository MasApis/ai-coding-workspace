import type { RouteObject } from "react-router";
import { AppShell } from "../components/layout/AppShell.js";
import { ComponentDemo } from "../demo/ComponentDemo.js";
import { ChatPage } from "../pages/ChatPage.js";
import { ExportsPage } from "../pages/ExportsPage.js";
import { DesignPage } from "../pages/DesignPage.js";
import { NotFoundPage, TemplatesPage } from "../pages/MiscPages.js";
import { NewProjectPage } from "../pages/NewProjectPage.js";
import { OverviewPage } from "../pages/OverviewPage.js";
import { PlanningPage } from "../pages/PlanningPage.js";
import { ProjectOverviewPage } from "../pages/ProjectOverviewPage.js";
import { ProjectsPage } from "../pages/ProjectsPage.js";
import { SettingsPage } from "../pages/SettingsPage.js";
import { TasksPage } from "../pages/TasksPage.js";

export const routePaths = [
  "/",
  "/projects",
  "/projects/new",
  "/projects/:projectId",
  "/projects/:projectId/planning/:documentType",
  "/projects/:projectId/tasks",
  "/projects/:projectId/chat",
  "/projects/:projectId/chat/:conversationId",
  "/projects/:projectId/exports",
  "/projects/:projectId/design",
  "/templates",
  "/settings",
  "/demo",
  "*",
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <OverviewPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/new", element: <NewProjectPage /> },
      { path: "/projects/:projectId", element: <ProjectOverviewPage /> },
      { path: "/projects/:projectId/planning/:documentType", element: <PlanningPage /> },
      { path: "/projects/:projectId/tasks", element: <TasksPage /> },
      { path: "/projects/:projectId/chat", element: <ChatPage /> },
      { path: "/projects/:projectId/chat/:conversationId", element: <ChatPage /> },
      { path: "/projects/:projectId/exports", element: <ExportsPage /> },
      { path: "/projects/:projectId/design", element: <DesignPage /> },
      { path: "/templates", element: <TemplatesPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/demo", element: <ComponentDemo /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
