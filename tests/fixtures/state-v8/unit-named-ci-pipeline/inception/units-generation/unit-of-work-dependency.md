# Unit of work dependency

The test harness depends on the pipeline config.

```yaml
units:
  - name: ci-pipeline
    kind: library
    depends_on: []
  - name: build-and-test
    kind: service
    depends_on: [ci-pipeline]
```
