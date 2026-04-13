# Playwright UI + API Framework Handbook

This handbook explains the Playwright + TypeScript framework in a way that helps two kinds of readers:

- engineers who want to understand how this framework works today
- engineers who want to build a framework like this again from scratch

It is intentionally written as a teaching document, not only as a repository note.  
The goal is to explain:

- what each layer does
- why that layer exists
- how that layer is implemented
- what problem it solves
- how it connects to the rest of the framework

This framework is one automation system with three execution modes:

- UI automation
- API automation
- hybrid UI + API automation

---

## How To Use This Handbook

This document is designed to be read in order.

If you are still learning framework design, read it from the beginning and treat each section as one layer in the system.

If you already know Playwright well, you can use this shorter path:

- sections 1 to 5 for context
- sections 6 to 20 for the actual architecture
- sections 22 to 26 for usage and recreation guidance

If your goal is to rebuild a framework like this later, sections 26 and 27 are the practical blueprint.

### Chapter Map

- sections 1 to 5 explain the problem, goals, structure, and execution flow
- sections 6 to 20 explain the framework layer by layer
- sections 21 to 25 show how the framework is used in practice
- sections 26 to 29 explain how to recreate, extend, and protect the design

---

## 1. What Problem This Framework Solves

Many automation teams begin with one UI framework and later create a separate API framework. That often creates duplication:

- two different configuration styles
- two different logging styles
- two different folder structures
- two different patterns for tests
- two different reporting models

Over time, the team has to maintain two automation systems instead of one.

This framework solves that problem by combining UI, API, and hybrid testing into one architecture.

The idea is simple:

- one shared runtime
- one shared configuration model
- one shared reporting model
- one shared observability model
- separate domain layers for UI pages and API services

That gives us consistency without forcing UI and API code into the same abstraction.

---

## 2. Design Goals

This framework is designed around the following goals.

### 2.1 One Foundation, Multiple Execution Modes

The framework should support:

- UI-only scenarios
- API-only scenarios
- business flows that cross both UI and API

without creating duplicate infrastructure.

### 2.2 Tests Should Express Intent

A good test should read like business behavior, not low-level implementation.

Good:

```ts
await bookingService.createBooking(payload);
await homePage.verifyRoomCatalogVisible();
```

Weak:

```ts
await request.post('/booking', { data: payload });
await page.locator('.card-title').nth(0).textContent();
```

### 2.3 Pages Own UI Behavior

Selectors, UI actions, and UI assertions belong in page objects and helper layers, not inside test bodies.

In this framework, that also means page objects should call helper utilities such as:

- `this.ui.element`
- `this.ui.editBox`
- `this.ui.dropdown`
- `this.waitUtils`
- `this.expectUtils`
- `this.assertUtils`

instead of calling raw low-level Playwright APIs directly in most cases.

### 2.4 Services Own API Behavior

HTTP mechanics belong in the API core. Business workflows belong in services. Tests should not manually construct every request.

### 2.5 Runtime Validation Matters

TypeScript types are not enough for API testing because they do not validate live server responses at runtime.  
This framework uses Zod contracts to validate actual API response shape during execution.

### 2.6 Fixtures Own Dependency Injection

Tests should receive ready-to-use dependencies from fixtures instead of manually creating pages, clients, tokens, and cleanup logic.

### 2.7 Observability Is Part of the Framework

Logging, metrics, reporting, and failure analysis are first-class framework concerns, not optional extras.

---

## 3. High-Level Architecture

At a high level, the framework looks like this:

```text
Tests
  ↓
Fixtures
  ↓
Pages / Services
  ↓
Helpers / Assertions / Test Data / Observability
  ↓
Core Infrastructure
  ↓
Configuration
```

Each layer has a specific responsibility.

### Layer Summary

| Layer | Responsibility |
|---|---|
| Tests | express scenario intent |
| Fixtures | inject dependencies |
| Pages | own UI workflows |
| Services | own API workflows |
| Helpers | own low-level mechanics |
| Assertions / Contracts | validate runtime behavior |
| Core | API client, auth, logger bridge |
| Config | environment and runtime settings |

---

## 4. Repository Structure

```text
playwright-ui-api-framework/
├── docs/
│   └── framework-architecture.md
├── src/
│   ├── assertions/
│   ├── config/
│   ├── contracts/
│   ├── core/
│   ├── fixtures/
│   ├── helper/
│   ├── models/
│   ├── observability/
│   ├── pages/
│   ├── runner/
│   ├── services/
│   ├── support/
│   ├── test-data/
│   └── utils/
├── tests/
│   ├── api/
│   ├── app/
│   └── ui/
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

Why this structure is useful:

- `src/` contains reusable framework code
- `tests/` contains scenario code
- `docs/` contains engineering knowledge
- UI and API layers are separated by responsibility, not by repository

---

## 5. End-to-End Execution Flow

Before we study each layer independently, it helps to understand the full execution flow.

### Example: Hybrid Test Flow

Imagine a hybrid scenario:

1. test starts in `tests/app/...`
2. test imports `appTest`
3. fixture injects:
   - browser page support from `uiTest`
   - API support from `AppFixture`
4. test calls an API service
5. `ApiClient` performs the request
6. `MetricsCollector` records the API execution
7. test calls a page object
8. page object uses action/wait helpers
9. assertions pass or fail
10. cleanup registry removes created data
11. metrics are flushed
12. global teardown prints summaries and failure diagnostics

This layered flow is what makes the framework maintainable.

---

## 6. Runtime Layer

The runtime layer defines how the framework starts, runs, records artifacts, and finishes.

### Main Files

- [playwright.config.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/playwright.config.ts)
- [src/config/global-setup.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/config/global-setup.ts)
- [src/config/global-teardown.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/config/global-teardown.ts)
- [src/config/PageSetup.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/config/PageSetup.ts)

### Why This Layer Exists

Without a runtime layer, teams often repeat:

- artifact settings
- browser settings
- report configuration
- failure capture logic
- startup / teardown logic

inside multiple files.

This layer centralizes that.

### What `playwright.config.ts` Does

It defines:

- test root directory
- test timeout
- workers and retries
- output locations
- reporting stack
- browser project
- screenshot / video / trace rules
- global setup / teardown hooks

For this framework, the runtime also intentionally defines a longer default test timeout than Playwright's out-of-the-box default. That is because the sample application is a public demo environment and can occasionally respond slowly, especially for authenticated API traffic.

Example:

```ts
export default defineConfig({
  testDir: './tests',
  timeout: PlaywrightConfigHelper.getTestTimeout(),
  retries: PlaywrightConfigHelper.getRetries(),
  outputDir: PlaywrightConfigHelper.getOutputDirectory(),
  reporter: PlaywrightConfigHelper.resolveReporters(),
  globalSetup: './src/config/global-setup',
  globalTeardown: './src/config/global-teardown',
  use: {
    baseURL: ConfigManager.getUiBaseUrl(),
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
```

### Why the Runtime Is Shared

UI, API, and hybrid suites all benefit from:

- the same reporting
- the same worker/retry rules
- the same artifact model
- the same environment awareness

That is why there is one runtime, not separate UI/API configs.

---

## 7. Configuration Layer

The configuration layer is the single source of truth for environment-specific and runtime-specific values.

### Main File

- [src/config/ConfigManager.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/config/ConfigManager.ts)

### Why This Layer Exists

If page objects, services, and fixtures read `process.env` directly:

- configuration becomes inconsistent
- defaults get duplicated
- changing environments becomes harder
- logic spreads across the whole codebase

`ConfigManager` prevents that by centralizing all configuration access.

### What It Manages

- environment name
- UI base URL
- API base URL
- API request base URL
- browser selection
- headless mode
- timeout
- test timeout
- CI mode
- retry count
- username and password
- logging flags

It is useful to think of the two timeout values separately:

- `API_TIMEOUT` controls individual request duration
- `TEST_TIMEOUT` controls total test duration including setup, execution, and cleanup

### Important Design Detail: API Base URL vs API Request Base URL

This is an important teaching point.

The framework keeps:

- `getApiBaseUrl()` -> human-friendly logical API base, like `https://site/api`
- `getApiRequestBaseUrl()` -> request-safe base, like `https://site/api/`

Why?

Because Playwright resolves relative request URLs differently depending on trailing slash behavior. During implementation, this detail caused API requests to hit the site root instead of `/api`. The dedicated request base URL solves that cleanly.

This is a good handbook example of why a framework often needs a configuration abstraction instead of using literal strings everywhere.

### Example

```ts
static getUiBaseUrl(): string {
  const explicit = process.env.UI_BASE_URL || process.env.BASE_URL;
  if (explicit) {
    return this.normalizeUrl(explicit);
  }

  return 'https://automationintesting.online';
}

static getApiBaseUrl(): string {
  const explicit = process.env.API_BASE_URL;
  if (explicit) {
    return this.normalizeUrl(explicit);
  }

  return `${this.getUiBaseUrl()}/api`;
}

static getApiRequestBaseUrl(): string {
  return `${this.getApiBaseUrl()}/`;
}
```

What this teaches:

- defaults should live in one place
- string normalization should live in one place
- UI and API URLs should be related, but not mixed together blindly
- one small helper method can prevent a large number of runtime failures

### Rule For Framework Builders

Do not let tests or services read environment variables directly when a configuration layer exists.

---

## 8. Fixture Layer

Fixtures are the framework’s dependency injection mechanism.

### Main Files

- [src/fixtures/UiFixture.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/fixtures/UiFixture.ts)
- [src/fixtures/ApiFixture.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/fixtures/ApiFixture.ts)
- [src/fixtures/AppFixture.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/fixtures/AppFixture.ts)

### Why This Layer Exists

Without fixtures, each test would need to manually build:

- page actions
- page objects
- API request context
- API client
- auth setup
- cleanup registry
- service instances

That would make tests long, repetitive, and inconsistent.

### The Three Execution Modes

#### `uiTest`

Used for browser-only scenarios.

Injects:

- `pageActions`
- `homePage`
- `adminLoginPage`
- `adminRoomsPage`

#### `apiTest`

Used for service/API scenarios.

Injects:

- `apiContext`
- `apiClient`
- `authService`
- `roomService`
- `authenticatedRoomService`
- `bookingService`
- `authenticatedBookingService`
- `registry`

#### `appTest`

Used for hybrid scenarios.

Combines:

- UI fixture dependencies
- API fixture dependencies

### Why Separate Fixtures Are Better Than One Giant Fixture

Because different scenario types need different tools.

Benefits:

- UI tests stay simple
- API tests stay fast
- hybrid tests get both layers only when needed

This is a good example of focused dependency injection design.

### Example

```ts
export const apiTest = base.extend<ApiFixtures>({
  apiContext: async ({}, use) => {
    const context = await request.newContext({
      baseURL: ConfigManager.getApiRequestBaseUrl(),
    });

    await use(context);
    await context.dispose();
  },
});
```

The most important idea here is not only object creation.
It is lifecycle ownership.

The fixture creates the dependency, gives it to the test, and then disposes or finalizes it in a standard way.

That gives the framework a reliable place to attach:

- setup
- teardown
- cleanup
- logging
- metrics flushing

### Beginner Mental Model

Think of a fixture as the framework saying:

`Do not assemble the tool by hand in every test. Ask for the right tool, and I will prepare and clean it up for you.`

### Rule For Framework Builders

Inject dependencies through fixtures.  
Do not make test writers construct framework infrastructure manually.

---

## 9. UI Layer

The UI layer is built around page objects.

### Main Files

- [src/pages/base/BasePage.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/pages/base/BasePage.ts)
- [src/pages/homePage.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/pages/homePage.ts)
- [src/pages/adminLoginPage.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/pages/adminLoginPage.ts)
- [src/pages/adminRoomsPage.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/pages/adminRoomsPage.ts)

### Why The UI Layer Exists

If tests use raw locators directly:

- tests become fragile
- UI intent is harder to read
- selector changes affect many test files

Page objects solve that by giving the UI a proper abstraction.

### `BasePage`

`BasePage` standardizes:

- page navigation
- page-loaded verification
- page reload flow
- access to helper classes

It means every page does not need to reinvent the same mechanics.

### Page Object Responsibilities

A page object should own:

- navigation for that page
- page-specific waits
- page-specific assertions
- page-specific user actions

A page object should not own:

- raw business test orchestration across many domains
- API setup logic
- environment lookup logic

### Locator Separation

Locators live under:

- [src/support/locators/BookingHomePageLocators.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/support/locators/BookingHomePageLocators.ts)
- [src/support/locators/AdminLoginPageLocators.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/support/locators/AdminLoginPageLocators.ts)
- [src/support/locators/AdminRoomsPageLocators.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/support/locators/AdminRoomsPageLocators.ts)

This is useful because selector changes are more likely than behavior changes.

### Example

```ts
async verifyLoginFormVisible(): Promise<void> {
  await StepRunner.run('Admin Login - verify login form', async () => {
    await this.expectUtils.expectElementToHaveText(
      this.page.locator(AdminLoginPageLocators.LOGIN_HEADING),
      'admin login heading',
      /login/i,
      'Admin login heading is not visible or does not contain expected text'
    );
    await this.expectUtils.expectElementToBeVisible(
      this.page.locator(AdminLoginPageLocators.USERNAME),
      'admin username input',
      'Admin username input is not visible'
    );
  });
}
```

### Why The Current UI Assertions Were Adjusted

During live execution against the public demo site, exact seed-data assumptions turned out to be too brittle.  
The framework now checks:

- that the catalog is visible
- that room cards are populated
- that the admin room inventory is populated
- that explicitly expected room names can be verified when needed

That is a valuable lesson:

When a public demo system is mutable, smoke tests should validate stable user-visible behavior, not hard-code all data values.

---

## 10. UI Actions, Waits, and Helper Layer

The UI layer sits on top of helper abstractions that own low-level mechanics.

### Main Files

- [src/helper/actions/PageActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/PageActions.ts)
- [src/helper/actions/UIActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/UIActions.ts)
- [src/helper/actions/UIElementActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/UIElementActions.ts)
- [src/helper/actions/EditBoxActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/EditBoxActions.ts)
- [src/helper/actions/DropDownActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/DropDownActions.ts)
- [src/helper/actions/CheckboxActions.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/actions/CheckboxActions.ts)
- [src/helper/waits/WaitUtils.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/waits/WaitUtils.ts)
- [src/helper/asserts/AssertUtils.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/asserts/AssertUtils.ts)
- [src/helper/asserts/ExpectUtils.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/asserts/ExpectUtils.ts)

### Why This Layer Exists

This layer keeps the page objects clean.

Without this layer:

- pages would repeat low-level interaction code
- waiting strategies would become inconsistent
- logging around UI actions would be scattered

### What It Provides

- browser page management
- typed locator handling
- input typing/filling
- click helpers
- waits for visibility, navigation, page readiness
- reusable element assertions through `ExpectUtils`
- reusable plain-value assertions through `AssertUtils`

### Preferred Usage Pattern

Inside page objects, the framework now prefers this split:

- use `this.pageActions` for browser/session mechanics like navigation and tab switching
- use `this.ui.element` for general element interactions like click, hover, text, and count
- use `this.ui.editBox`, `this.ui.dropdown`, and `this.ui.checkbox` for control-specific interactions
- use `this.waitUtils` for wait orchestration
- use `this.expectUtils` for locator/page assertions
- use `this.assertUtils` for plain values like counts, booleans, equality, and collections

That means page objects consume helpers instead of calling raw Playwright APIs directly.

### Example: A Page Method Built The Intended Way

This is the pattern the framework wants readers to copy when they build new page methods.

```ts
async verifyRoomCardsArePopulated(): Promise<void> {
  await StepRunner.run('Home Page - verify room cards are populated', async () => {
    await this.focusRoomCatalog();
    const roomCount = await this.ui.element.count(this.roomTitles);

    await this.assertUtils.assertGreaterThanOrEqual(
      roomCount,
      3,
      'Home page should show at least three room cards'
    );

    for (let index = 0; index < Math.min(roomCount, 3); index++) {
      const title = await this.ui.element.text(this.roomTitles.nth(index));

      await this.assertUtils.assertGreaterThan(
        title.length,
        0,
        `Room card ${index + 1} title should not be empty`
      );
    }
  });
}
```

Why this method is a good example:

- scrolling and element access happen through helper classes
- plain-value checks use `assertUtils`
- locator-based checks use `expectUtils`
- the step is named in business language, not in low-level browser language

This gives us a strong rule:

`page method = page intent + helper calls + framework assertions`

not:

`page method = raw locator operations + inline expect usage + repeated wait logic`

### What Tests Should Import

The test layer should normally import:

- `uiTest` for browser-only scenarios
- `apiTest` for service/API scenarios
- `appTest` for hybrid scenarios

And when tests need plain-value assertions, they should use the fixture-injected `assertUtils` object rather than importing raw Playwright `expect` for ordinary value checks.

### Why `PageActions` Is Important

`PageActions` is the browser/session utility object. It owns the active Playwright page and context.

It centralizes things like:

- `gotoURL`
- `reloadPage`
- `getCurrentUrl`
- `waitForNavigation`

This is useful because the rest of the UI layer does not need to manage page state directly.

### Action Helper Split

The framework keeps helper ownership narrow so responsibilities stay obvious.

- `PageActions` owns page and browser-context behavior such as navigation, reload, history, and window handling
- `UIElementActions` owns general element interactions such as `click(...)`, `text(...)`, `count(...)`, `hover(...)`, and visibility checks
- `EditBoxActions`, `DropDownActions`, and `CheckboxActions` own control-specific interactions

`UIActions` is now a thin facade over those stateless helpers. It gives page objects one stable entry point without re-implementing any interaction logic or storing mutable locator state.

Examples of the clearer names now preferred in the framework:

- `this.pageActions.gotoURL(...)`
- `this.ui.element.click(...)`
- `this.ui.element.count(...)`
- `this.ui.editBox.fill(...)`
- `this.ui.dropdown.selectByValue(...)`

### Wait Naming Rule

The wait layer should describe what condition the framework is waiting for, not how Playwright happens to implement that wait internally.

Examples of clear wait names:

- `waitForVisible(...)`
- `waitForHidden(...)`
- `waitForAttached(...)`
- `waitForCount(...)`
- `waitForValue(...)`
- `sleep(...)`

Notice two design choices:

- a condition-style name like `waitForCount(...)` is clearer than a verbose name like `waitForElementCount(...)`
- a deliberate hard wait is named `sleep(...)` to make the cost obvious and to discourage casual use

The purpose of a helper layer is not just reuse. It is also vocabulary.  
If the framework vocabulary is clean, the page layer becomes easier to read and easier to teach.

### Rule For Framework Builders

Keep page objects focused on page meaning.  
Put generic browser interaction mechanics in helper classes.

Another useful rule is:

If a helper name is clearer, use the clearer name and remove the old one. Because this repository is treated as a fresh framework, it does not preserve older alias-style method names just for migration convenience.

One more rule is equally important:

If a helper can work with either a selector string or a Playwright `Locator`, make that behavior standard across the helper layer. Mixed helper APIs force page authors to remember unnecessary exceptions.

---

## 11. API Core Layer

The API core layer is the transport and authentication foundation for all API testing.

### Main Files

- [src/core/ApiClient.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/core/ApiClient.ts)
- [src/core/AuthManager.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/core/AuthManager.ts)
- [src/core/Logger.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/core/Logger.ts)

### Why This Layer Exists

If tests or services call `request.get()` or `request.post()` directly everywhere:

- headers become inconsistent
- auth becomes duplicated
- timeout logic is repeated
- retry logic is repeated
- observability gets skipped

The API core solves that.

### `ApiClient`

`ApiClient` is the single HTTP execution layer.

It owns:

- request execution
- header composition
- auth header injection
- timeout usage
- retry behavior
- request logging
- metrics recording

This is one of the most important files in the framework because every service depends on it.

### `AuthManager`

`AuthManager` owns:

- login request flow
- token caching
- auth header creation
- token clearing

The benefit is that services do not need to know how authentication is implemented.

### Example

```ts
const response = await this.executeWithRetry(
  () =>
    this.request.post(normalizedEndpoint, {
      headers: this.buildHeaders(options?.headers, options?.authenticated),
      data: body,
      timeout: ConfigManager.getTimeout(),
    }),
  'POST',
  normalizedEndpoint
);
```

What this teaches:

- the caller asks for a business action
- the client applies shared transport rules
- timeout handling stays consistent
- retry behavior stays consistent
- headers stay consistent
- logging and metrics happen automatically

The service or manager expresses the business action. The client handles the transport rules.

### Rule For Framework Builders

Never let business tests become your transport layer.  
Put HTTP mechanics into one client abstraction.

---

## 12. API Service Layer

The service layer translates business operations into API workflows.

### Main Files

- [src/services/AuthService.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/services/AuthService.ts)
- [src/services/RoomService.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/services/RoomService.ts)
- [src/services/BookingService.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/services/BookingService.ts)

### Why This Layer Exists

Services keep tests readable and business-focused.

Without services, tests would need to know:

- endpoints
- auth behavior
- payload shape
- response validation behavior

Services hide that detail.

### Example

Instead of writing:

```ts
const response = await apiClient.post('/booking', payload);
await ResponseValidator.expectStatus(response, 201);
```

the test can write:

```ts
const booking = await bookingService.createBooking(payload);
```

That is easier to read and easier to maintain.

### `AuthService`

Responsibilities:

- login
- return token
- health probe
- logout
- auth state checks

### `RoomService`

Responsibilities:

- list rooms
- get room by id
- create room
- delete room

### `BookingService`

Responsibilities:

- create booking
- retrieve booking
- get booking summary
- delete booking

### Service Layer Rule

A service should represent a domain or resource, not a random collection of unrelated endpoints.

---

## 13. Contract Layer

The contract layer defines runtime expectations for API payloads.

### Main Files

- [src/contracts/AuthContract.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/contracts/AuthContract.ts)
- [src/contracts/RoomContract.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/contracts/RoomContract.ts)
- [src/contracts/BookingContract.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/contracts/BookingContract.ts)

### Why This Layer Exists

TypeScript types only help at compile time.

If the server changes a response shape in production:

- TypeScript will not protect you
- tests may keep compiling
- your framework may start using incorrect assumptions

Zod contracts solve that by validating real runtime payloads.

### Example

```ts
export const LoginResponseSchema = z.object({
  token: z.string().min(1),
});
```

This means the framework does not just assume the API returns a token. It checks that it really does.

### Why Contracts Are Different From Models

Contracts define runtime validation rules.  
Models define reusable exported types derived from those rules.

That separation is useful because:

- contracts are validation-oriented
- models are consumption-oriented

### Rule For Framework Builders

For API frameworks, runtime schema validation is not “nice to have”. It is one of the biggest quality multipliers.

---

## 14. Models Layer

The models layer exports stable types derived from contracts.

### Main Files

- [src/models/AuthModels.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/models/AuthModels.ts)
- [src/models/RoomModels.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/models/RoomModels.ts)
- [src/models/BookingModels.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/models/BookingModels.ts)

### Why It Exists

This layer gives the project a stable type import surface while keeping the contract layer focused on validation rules.

This is a useful design when a framework grows larger.

---

## 15. Assertion and Validation Layer

This layer turns raw responses into validated framework outcomes.

### Main Files

- [src/assertions/ResponseValidator.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/assertions/ResponseValidator.ts)
- [src/assertions/ContractValidator.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/assertions/ContractValidator.ts)

### Why This Layer Exists

Tests and services should not all implement their own:

- status checks
- schema validation logic
- schema error formatting

`ResponseValidator` centralizes that behavior.

### Two Important Validation Modes

#### `validateSchema`

Use this when the framework needs the parsed typed data back.

Example:

```ts
return ResponseValidator.validateSchema(response, RoomsListSchema, 'getRooms');
```

#### `expectSchemaMatch`

Use this in contract tests when assertion-only validation is enough.

### Why This Layer Is Valuable

It makes error output better and keeps schema handling consistent.

---

## 16. Test Data Layer

The test data layer is responsible for generating payloads and keeping test-created data manageable.

### Main Files

- [src/test-data/AuthFactory.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/test-data/AuthFactory.ts)
- [src/test-data/RoomFactory.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/test-data/RoomFactory.ts)
- [src/test-data/BookingFactory.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/test-data/BookingFactory.ts)
- [src/test-data/TestDataRegistry.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/test-data/TestDataRegistry.ts)
- [src/test-data/TestDataCleanup.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/test-data/TestDataCleanup.ts)

### Why This Layer Exists

Good test data design is one of the biggest differences between a demo framework and a maintainable framework.

This layer solves:

- duplicated inline payloads
- non-unique test data
- shared-environment pollution
- cleanup inconsistency

### Factories

Factories generate default valid payloads.

Example:

```ts
const roomPayload = RoomFactory.create();
```

Benefits:

- tests stay smaller
- payload generation becomes consistent
- uniqueness can be built into one place

### Registry and Cleanup

Hybrid and API tests may create rooms or bookings.  
The registry records what was created.  
Cleanup removes those resources after the test.

This is a strong pattern because cleanup logic stays out of test bodies.

### Example Flow

1. test creates room
2. room id is discovered
3. registry tracks `room`, `id`
4. fixture teardown calls cleanup
5. cleanup uses service/client to delete created entities

### Important Real-World Lesson

Shared public environments are mutable.  
That means test data must avoid collisions and clean up after itself.

The booking factory was adjusted during implementation to generate more stable dates and room combinations for the demo application.

---

## 17. Reporting Layer

The reporting layer makes execution visible and debuggable for humans.

### Main Files

- [src/helper/reporting/AllureReporter.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/reporting/AllureReporter.ts)
- [src/helper/reporting/StepRunner.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/reporting/StepRunner.ts)
- [src/helper/reporting/GenerateReports.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/reporting/GenerateReports.ts)

### Why This Layer Exists

Tests are not useful if failures are hard to understand.

This layer provides:

- structured Allure metadata
- named execution steps
- screenshot / HTML / video / JSON attachments
- readable execution context

### Why UI-Style Reporting Became The Main Standard

The original UI framework had richer reporting behavior, so the merged framework uses that as the main reporting standard for all execution modes.

This is why even API and hybrid runs feel like one framework.

### Example

```ts
await AllureReporter.attachDetails({
  epic: 'Unified Framework',
  feature: 'API Smoke',
  story: 'Admin authentication returns a reusable token',
  severity: 'critical',
});
```

### Why StepRunner Is Useful

Named steps make failures much more understandable in reports.

Instead of:

- generic assertion failure

you get:

- `Home Page - verify room catalog`
- `Admin Login - submit credentials`
- `Admin Rooms - verify room management page`

That is much easier for teams to diagnose.

---

## 18. Observability Layer

The observability layer adds system-level insight to the framework, especially for API behavior.

### Main Files

- [src/observability/MetricsCollector.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/observability/MetricsCollector.ts)
- [src/observability/FailureAnalyzer.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/observability/FailureAnalyzer.ts)
- [src/config/global-teardown.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/config/global-teardown.ts)

### Why This Layer Exists

Pass/fail alone is not enough in a modern framework.

We also want to know:

- which endpoints were called
- how fast they were
- how often they failed
- whether failures were auth, payload, schema, timeout, or network related

### MetricsCollector: The API Black Box Recorder

`MetricsCollector` records API request facts during execution.

Each metric includes:

- method
- endpoint
- status code
- duration
- success/failure
- timestamp
- retry count
- optional schema violation
- optional error message

In plain language:

`MetricsCollector` is the framework's API black box recorder.

It captures what each request did, how long it took, whether it failed, and what kind of failure happened.

### How It Works Step By Step

The execution sequence is:

1. a test calls a service
2. the service calls `ApiClient`
3. `ApiClient` executes the HTTP request
4. `ApiClient` records a metric
5. the worker stores that metric in memory
6. fixture teardown flushes in-memory metrics to disk
7. global teardown reloads all flushed metrics
8. the framework prints summaries and failure analysis

This design is important because observability becomes automatic.
The test writer does not need to remember any extra instrumentation.

### Real Request Metric Shape

```ts
export interface RequestMetric {
  method: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  timestamp: string;
  retries: number;
  schemaViolation?: boolean;
  errorMessage?: string;
}
```

This one structure allows the framework to answer:

- what endpoint was called
- whether it succeeded
- how long it took
- whether retries happened
- whether schema validation failed
- whether transport/network failure happened

### Why Metrics Are Recorded Inside `ApiClient`

This is an important architectural decision.

Because metrics are recorded in [ApiClient.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/core/ApiClient.ts), every API request in the framework automatically becomes observable.

That means:

- tests do not need to remember to collect metrics
- services do not duplicate observability logic
- instrumentation is consistent

This is one of the biggest architecture lessons in the framework:

if something should happen for every request, it belongs in infrastructure, not in test code.

### Why Metrics Are Written To Disk

Playwright workers and global teardown run in separate processes.

If metrics stayed only in memory:

- teardown would not see the whole run

The framework solves this by:

1. recording metrics in memory during execution
2. flushing them to a shared NDJSON buffer
3. reloading them in global teardown
4. printing summaries and diagnostics

This is not just an implementation trick.
It is what makes observability work correctly with Playwright's multi-process execution model.

Without this step:

- each worker would only know its own metrics
- teardown would not see the full run
- the final summary would be incomplete

### Flow Diagram In Words

```text
Test
  -> Service
  -> ApiClient
  -> MetricsCollector.record()
  -> worker memory
  -> MetricsCollector.flush()
  -> reports/.metrics-buffer.ndjson
  -> global teardown
  -> summary + failure analysis
```

### Example

```ts
metricsCollector.record({
  method: 'POST',
  endpoint: 'booking',
  statusCode: 201,
  durationMs: 538,
  success: true,
  timestamp: new Date().toISOString(),
  retries: 0,
});
```

### Example Summary Output

At the end of a run, this layer can produce a summary like:

```text
GET room            calls=4 successRate=100.0% avgMs=214 p95Ms=301 failures=0
POST booking        calls=2 successRate=50.0%  avgMs=488 p95Ms=611 failures=1
DELETE booking/23   calls=1 successRate=100.0% avgMs=171 p95Ms=171 failures=0
```

This is useful even when tests pass, because it still reveals:

- slow endpoints
- unstable endpoints
- heavily retried endpoints

### FailureAnalyzer

`FailureAnalyzer` converts raw failed metrics into useful categories:

- auth failure
- not found
- client error
- server error
- schema violation
- timeout
- network error

This makes triage faster and CI output easier to understand.

Typical interpretations:

- `401` or `403` usually indicates auth failure
- `404` often points to wrong or deleted test data
- `5xx` often points to environment instability
- `schemaViolation` often points to contract drift
- `statusCode: 0` often points to timeout or network failure

### What This Layer Is Not

It is not only a flaky test detector.

It also helps with:

- performance visibility
- diagnostics
- API trend awareness
- failure classification

So the short answer to "Why do we need MetricsCollector?" is:

`Because a good framework should explain behavior, not only report pass or fail.`

### Rule For Framework Builders

Observability should be designed into infrastructure, not added later as an afterthought.

---

## 19. Logging Layer

The framework uses a shared logging model across execution types.

### Main Files

- [src/helper/logger/Logger.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/helper/logger/Logger.ts)
- [src/core/Logger.ts](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/src/core/Logger.ts)

### Why This Layer Exists

Logging helps explain:

- what the framework is doing
- where it is waiting
- what request just ran
- how long something took

This becomes especially helpful in hybrid execution where both UI and API actions happen in the same test.

---

## 20. Test Organization

The framework organizes tests by execution intent.

### Test Folders

- [tests/ui](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/tests/ui)
- [tests/api](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/tests/api)
- [tests/app](/Users/rajesh.yemul/Practice%20Project/pw-ui-api-framework/tests/app)

### Why This Structure Works

It answers a simple question:

What kind of system interaction is this test meant to validate?

#### `tests/ui`

Use for browser-only scenarios.

#### `tests/api`

Use for service-level scenarios.

Subtypes currently include:

- smoke
- integration
- contract

#### `tests/app`

Use for flows that intentionally cross layers.

Examples:

- public API + public UI availability in one journey
- create room by API and verify in admin UI

### Rule For Framework Builders

Organize tests by execution intent, not by random naming style.

---

## 21. Current Sample Application

The current reference application is Restful-Booker-Platform.

UI:

- `https://automationintesting.online`

API:

- `https://automationintesting.online/api`

### Why It Was Chosen

It is a strong starter system because it exposes:

- public UI
- authenticated admin UI
- public API
- authenticated API
- a domain simple enough to teach UI, API, and hybrid design

### Important Lesson From The Live Sample

Public demo systems are mutable.

That affected:

- room inventory assumptions
- booking collisions
- hybrid smoke design

The framework was improved by adapting sample assertions to stable behavior rather than hard-coding fragile assumptions.

That is an important real-world engineering lesson.

---

## 22. Writing Tests In This Framework

Before looking at code, use this decision rule:

- choose `tests/ui` when browser behavior is the real subject
- choose `tests/api` when the scenario can be proven through service behavior alone
- choose `tests/app` when the value of the test is the connection between API and UI

### UI Test Example

```ts
import { uiTest as test } from '@fixtures/UiFixture';

test('visitor can view the room catalog', async ({ homePage }) => {
  await homePage.navigate();
  await homePage.verifyPageLoaded();
  await homePage.verifyRoomCatalogVisible();
});
```

### API Test Example

```ts
import { apiTest as test } from '@fixtures/ApiFixture';

test('admin login returns token', async ({ authService, assertUtils }) => {
  const loginResponse = await authService.loginAndGetToken();
  await assertUtils.assertTrue(
    Boolean(loginResponse.token),
    'Admin login should return a non-empty token'
  );
});
```

### Hybrid Test Example

```ts
import { appTest as test } from '@fixtures/AppFixture';

test('room created by API is visible in admin UI', async ({
  authenticatedRoomService,
  roomService,
  registry,
  adminLoginPage,
  adminRoomsPage,
  assertUtils,
}) => {
  const payload = RoomFactory.create();
  const createResponse = await authenticatedRoomService.createRoom(payload);
  await assertUtils.assertTrue(
    createResponse.success,
    'Room creation response should indicate success'
  );

  const rooms = await roomService.getRooms();
  const createdRoom = rooms.rooms.find(room => room.roomName === payload.roomName);
  await assertUtils.assertDefined(
    createdRoom,
    'Created room should be visible in the room catalog response'
  );
  registry.track('room', createdRoom!.roomid);

  await adminLoginPage.navigate();
  await adminLoginPage.loginAsAdmin();
  await adminRoomsPage.verifyRoomVisible(payload.roomName);
});
```

### What These Examples Teach

- tests orchestrate
- fixtures inject
- pages own UI meaning
- services own API meaning
- cleanup and observability happen around the edges

They also teach an important style rule:

- the test layer should speak in framework language
- the helper layer should hide low-level mechanics
- the assertion layer should standardize how success and failure are described

---

## 23. How To Add A New Page

When adding a new UI page:

1. create a locator file under `src/support/locators`
2. create a page object under `src/pages`
3. extend `BasePage`
4. add page-specific methods
5. expose it through `UiFixture` if it should be injected
6. write tests under `tests/ui` or `tests/app`

### Example Outline

```ts
export class UserProfilePage extends BasePage {
  protected pageUrl = '/profile';
  protected pageTitle = /Profile/i;
  protected pageReadySelector = UserProfileLocators.HEADER;

  async verifyProfileLoaded(): Promise<void> {
    await this.expectUtils.expectElementToBeVisible(
      this.page.locator(UserProfileLocators.HEADER),
      'profile header',
      'Profile header is not visible'
    );
  }
}
```

---

## 24. How To Add A New API Service

When adding a new API domain:

1. define Zod contracts
2. export model types if needed
3. create a service class
4. use `ApiClient` for request execution
5. validate responses through `ResponseValidator`
6. expose the service through fixtures when useful
7. add smoke, integration, and contract tests where appropriate

### Example Outline

```ts
export class UserService {
  constructor(private readonly api: ApiClient) {}

  async getUsers(): Promise<UsersList> {
    const response = await this.api.get('/users');
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, UsersListSchema, 'getUsers');
  }
}
```

---

## 25. How To Add Contract Tests

Contract tests should validate runtime schema agreement, not full business workflows.

### Steps

1. identify the endpoint
2. define or reuse its schema
3. call the endpoint
4. assert status
5. validate schema

### Example

```ts
test('GET /room/:id matches RoomSchema', async ({ apiClient }) => {
  const response = await apiClient.get('/room/1');
  await ResponseValidator.expectStatus(response, 200);
  await ResponseValidator.expectSchemaMatch(response, RoomSchema, 'contract:GET /room/:id');
});
```

### Why Contract Tests Matter

They catch API drift early, even before workflow tests fail in more confusing ways.

---

## 26. How To Recreate A Framework Like This From Scratch

If someone wanted to build a framework like this again, this is the recommended order.

### Phase 1: Execution Foundation

Build:

- `package.json`
- `tsconfig.json`
- `playwright.config.ts`
- `ConfigManager`

Do not start with page objects or services before the runtime foundation exists.

### Phase 2: Fixture Foundation

Create:

- `uiTest`
- `apiTest`
- `appTest`

This defines how dependencies will enter tests.

### Phase 3: UI Foundation

Create:

- `BasePage`
- action helpers
- wait helpers
- first page object

### Phase 4: API Foundation

Create:

- `ApiClient`
- `AuthManager`
- first service
- first contract schema

### Phase 5: Reporting and Observability

Add:

- Allure metadata helpers
- step runner
- metrics collection
- failure analysis

### Phase 6: Test Data and Cleanup

Add:

- factories
- registry
- cleanup strategy

### Phase 7: Real Test Suites

Then create:

- UI smoke
- API smoke
- API health smoke
- API integration
- API contract
- hybrid smoke
- hybrid integration

This order matters because it builds the framework from foundation outward.

---

## 27. Common Mistakes To Avoid

### Mistake 1: Mixing UI and API Infrastructure

Do not make page objects send API requests.  
Do not make services manage browser state.

### Mistake 2: Skipping Runtime Validation

Compile-time types are not enough for API contracts.

### Mistake 3: Hardcoding Environment Values Everywhere

Use a config layer.

### Mistake 4: Writing Raw Selectors In Tests

Selectors belong in locator/page layers.

### Mistake 5: Letting Tests Manage Cleanup Manually

Use registry + cleanup pattern.

### Mistake 6: Ignoring Observability

A framework without diagnostics becomes expensive to maintain.

### Mistake 7: Overfitting Smoke Tests To Mutable Demo Data

Smoke tests should validate stable behavior, not fragile seed assumptions.

---

## 28. Final Architecture Message

The most important idea in this repository is not any single page object or service.

It is the design discipline:

- one runtime
- one config model
- one reporting model
- one observability model
- focused execution modes
- clear ownership by layer

If someone understands that structure, they can recreate a framework like this for another domain.

If they ignore that structure, they may still create tests, but they will not create a maintainable framework.

---

## 29. Where To Go Next

After understanding this handbook, the next logical steps are:

1. add more page objects for the sample application
2. add more service domains
3. add more hybrid business journeys
4. adapt the same framework structure to a second application
5. create team conventions for naming, tagging, and review

This handbook should be used as the architectural guide for those future changes.
