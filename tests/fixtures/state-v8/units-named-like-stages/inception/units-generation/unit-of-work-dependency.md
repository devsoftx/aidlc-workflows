# Unit of work dependency

The incident responder depends on the code reviewer.

```yaml
units:
  - name: code-review
    kind: library
    depends_on: []
  - name: incident-response
    kind: service
    depends_on: [code-review]
```
