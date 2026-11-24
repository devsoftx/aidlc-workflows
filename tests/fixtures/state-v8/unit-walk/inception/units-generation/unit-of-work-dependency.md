# Unit of work dependency

The CLI depends on the store.

```yaml
units:
  - name: store
    kind: library
    depends_on: []
  - name: cli
    kind: service
    depends_on: [store]
```
