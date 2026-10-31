import type { RouteObject } from "react-router";
import { AppShell } from "../components/layout/AppShell.js";
import { ProjectLayout } from "../components/project/ProjectLayout.js";
import { ChatPage } from "../pages/ChatPage.js";
import { DocumentsPage } from "../pages/DocumentsPage.js";
import { ExportsPage } from "../pages/ExportsPage.js";
import { DesignPage } from "../pages/DesignPage.js";
import { NotFoundPage } from "../pages/MiscPages.js";
import { TemplatesPage } from "../pages/TemplatesPage.js";
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
  "/projects/:projectId/documents",
  "/projects/:projectId/planning/:documentType",
  "/projects/:projectId/tasks",
  "/projects/:projectId/chat",
  "/projects/:projectId/chat/:conversationId",
  "/projects/:projectId/exports",
  "/projects/:projectId/design",
  "/templates",
  "/settings",
  "*",
];

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <OverviewPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/new", element: <NewProjectPage /> },
      // Every project screen shares one header and tab bar, so the project is
      // loaded once by the layout and handed to pages through the outlet.
      {
        path: "/projects/:projectId",
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: "documents", element: <DocumentsPage /> },
          { path: "planning/:documentType", element: <PlanningPage /> },
          { path: "tasks", element: <TasksPage /> },
          { path: "chat", element: <ChatPage /> },
          { path: "chat/:conversationId", element: <ChatPage /> },
          { path: "exports", element: <ExportsPage /> },
          { path: "design", element: <DesignPage /> },
        ],
      },
      { path: "/templates", element: <TemplatesPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
