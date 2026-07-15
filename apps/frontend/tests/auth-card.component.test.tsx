import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/auth/auth-card";

const loginMock = vi.fn();
const registerMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    login: loginMock,
    register: registerMock,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe("AuthCard", () => {
  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
    replaceMock.mockReset();
  });

  it("shows register validation errors before calling the API", () => {
    render(<AuthCard mode="register" />);

    const form = screen.getByRole("button", { name: /create account/i }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("submits valid login details and redirects to the dashboard", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue(undefined);

    render(<AuthCard mode="login" />);

    await user.type(screen.getByLabelText(/email/i), "mahesh@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password1");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("mahesh@example.com", "Password1");
    });
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });
});
