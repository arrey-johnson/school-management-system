# Data model (Phase 6)

Inventory quantity is the sum of `stock_movements.qty` (in positive, out negative). Calendar, announcements, and letter templates are school-admin tables.

```mermaid
erDiagram
  inventory_items ||--o{ stock_movements : moved
  calendar_events {
    string title
    string kind
  }
  announcements {
    string audience
    string expires_on
  }
  document_templates {
    string body
  }
```
