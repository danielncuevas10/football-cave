<!-- BEGIN:nextjs-agent-rules -->

# Current Project Context & Rules

## Technical Stack Constraints

- **Styling:** Mibile-first. Do not write vanilla CSS or utility frameworks unless specified.

## Mid-Project Security & Safety Rules

- **Dependencies:** Do not install any new npm packages without asking permission first.

## Working Process

- Before writing a new component, scan the existing layout to match the current one.
- Always run a build check to catch TypeScript errors before marking a task as complete.
- **Security & Data Leaks:** Make sure that the security is always met, and leave no room for leaks. Specifically: never hardcode API keys or secrets, lock down API routes so unauthorized users can't fetch sensitive data, and ensure data inputs are validated to prevent malicious injections.

<!-- END:nextjs-agent-rules -->
