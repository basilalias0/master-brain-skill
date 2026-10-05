# Test frameworks (load only the stack in use)

Detect the stack from its manifest, then use the project's own command first. The test guard counts tests, skips and assertions for all of these, and its counts were checked against each real runner. A skip form it does not know raises a "possible new skip form" flag.

| Stack | Manifest | Run | Test files | Notes |
|---|---|---|---|---|
| JS/TS | package.json | the `test` script (Vitest, Jest, node:test); Playwright for e2e | `*.test.*`, `*.spec.*` | role-based locators, no sleeps |
| Python | pyproject, requirements | `pytest -q` or `python -m unittest` | `test_*.py`, `*_test.py` | fixtures over globals; `pytest -q -x` to stop at first red |
| Go | go.mod | `go test ./...` | `*_test.go`, `TestXxx(t *testing.T)` | table-driven; `-run Name` for one test |
| Java/Kotlin | pom.xml, build.gradle | `mvn -q test` or `gradle test` | `*Test.java`, `*Tests.kt` | JUnit 5 `@Test`; `@Disabled` counts as a skip |
| Rust | Cargo.toml | `cargo test` | `#[test]` inline or `tests/` | `#[ignore]` counts as a skip |
| C# | *.csproj | `dotnet test` | `*Tests.cs` | xUnit `[Fact]`, NUnit `[Test]`; `Skip =` is a skip |
| Ruby | Gemfile | `bundle exec rspec` or `rake test` | `*_spec.rb`, `*_test.rb` | `xit`, `skip`, `fit` flagged |
| PHP | composer.json | `vendor/bin/phpunit` or `pest` | `*Test.php` | `markTestSkipped` counts as a skip |

If a toolchain is not installed, say so and report "not run"; never claim a pass.
