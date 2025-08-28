# Contributing to Hugsy

Thank you for your interest in contributing to Hugsy! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hugsy.git
   cd hugsy
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build the project:
   ```bash
   pnpm build
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage
```

### Linting and Formatting

```bash
# Run ESLint
pnpm lint

# Format code with Prettier
pnpm format
```

### Building

```bash
# Build all packages
pnpm build

# Development mode with watch
pnpm dev
```

## Project Structure

```
hugsy/
├── packages/
│   ├── cli/          # CLI tool
│   ├── compiler/     # Configuration compiler
│   └── types/        # TypeScript types
├── examples/         # Example projects
├── tests/           # Integration tests
└── docs/            # Documentation
```

## Making Changes

1. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Maintenance tasks

Examples:

```bash
git commit -m "feat: add support for YAML config files"
git commit -m "fix: resolve permission merging issue"
git commit -m "docs: update CLI usage examples"
```

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Maintain or improve code coverage

### Writing Tests

- Unit tests go in `packages/*/tests/`
- Integration tests go in `tests/`
- Use Vitest for testing

Example test:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should work correctly', () => {
    expect(myFunction()).toBe(expectedResult);
  });
});
```

## Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Clearly describe what changes you made and why
3. **Tests**: Include tests for your changes
4. **Documentation**: Update docs if needed
5. **Changelog**: We use changesets for versioning

### Creating a Changeset

For changes that should be included in the changelog:

```bash
pnpm changeset
```

Follow the prompts to describe your changes.

## Code Style

- TypeScript for all code
- ESLint for linting
- Prettier for formatting
- Use async/await over promises
- Prefer functional programming patterns

## Questions?

Feel free to:

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Join our community chat (if available)

## License

By contributing to Hugsy, you agree that your contributions will be licensed under the MIT License.
