export type HealthResponse = {
  status: string;
  app: string;
};

export type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

export type NavItem = {
  href: string;
  label: string;
};
