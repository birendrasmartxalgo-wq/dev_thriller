import { test, expect } from "@playwright/test";

/**
 * These smoke specs assume the backend has been seeded via
 * `bun run --cwd apps/backend seed:e2e`, which creates:
 *   - alice-e2e@test.local / Password1!  (owner of E2E Workspace)
 *   - bob-e2e@test.local  / Password1!   (member)
 *   - a channel named "general" in that workspace with a couple of messages.
 *
 * The exact selectors will need to track the real UI — mark them with
 * `data-testid` attributes in the components so these tests stay stable.
 */

const PRIMARY_EMAIL = process.env.E2E_PRIMARY_EMAIL ?? "alice-e2e@test.local";
const PRIMARY_PW = process.env.E2E_PRIMARY_PW ?? "Password1!";

test.describe("smoke", () => {
  test("login and send a message in the seeded chat", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("login-email").fill(PRIMARY_EMAIL);
    await page.getByTestId("login-password").fill(PRIMARY_PW);
    await page.getByTestId("login-submit").click();

    // Land on the dashboard / default workspace.
    // Authed root is the dashboard at "/"; tolerate the also-shipped /dashboard alias if added later.
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(dashboard)?(\?.*)?$/);

    // Open the "general" chat.
    await page.getByTestId("chat-link-general").click();

    const composer = page.getByTestId("message-composer");
    await expect(composer).toBeVisible();

    const marker = `e2e-ping-${Date.now()}`;
    await composer.fill(marker);
    await composer.press("Enter");

    // The message should appear in the message list.
    await expect(page.getByTestId("message-list").getByText(marker)).toBeVisible();
  });

  // Full invite flow: create a workspace, send an invite to a fresh email,
  // copy the token from the invite-success modal, and have that email sign up
  // via the /invite/:token page.
  test("create workspace, invite a second user, and have them join", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(PRIMARY_EMAIL);
    await page.getByTestId("login-password").fill(PRIMARY_PW);
    await page.getByTestId("login-submit").click();

    // Authed root is the dashboard at "/"; tolerate the also-shipped /dashboard alias if added later.
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(dashboard)?(\?.*)?$/);

    // Create a fresh workspace via the UI.
    const slug = `invite-${Date.now()}`;
    await page.getByTestId("create-workspace").click();
    await page.getByTestId("workspace-name").fill("Invite Test");
    await page.getByTestId("workspace-slug").fill(slug);
    await page.getByTestId("workspace-create-submit").click();
    await expect(page.getByTestId("workspace-title")).toContainText("Invite Test");

    // Invite a brand-new user — the test uses a throwaway mailbox.
    const inviteeEmail = `invitee-${Date.now()}@test.local`;
    await page.getByTestId("open-invite").click();
    await page.getByTestId("invite-email").fill(inviteeEmail);
    await page.getByTestId("invite-submit").click();
    const inviteToken = await page
      .getByTestId("invite-token")
      .textContent()
      .then((t) => (t ?? "").trim());
    expect(inviteToken.length).toBeGreaterThan(10);

    // The invitee signs up via the invite link.
    await page.context().clearCookies();
    await page.goto(`/invite/${inviteToken}`);
    await page.getByTestId("signup-name").fill("Invitee");
    await page.getByTestId("signup-email").fill(inviteeEmail);
    await page.getByTestId("signup-password").fill("Password1!");
    await page.getByTestId("signup-submit").click();

    // After sign-up + invite accept, they should land in the workspace.
    await expect(page.getByTestId("workspace-title")).toContainText("Invite Test");
  });
});
