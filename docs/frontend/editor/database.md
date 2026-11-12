# Database

[database.tsx](../../../packages/web/src/modules/database.tsx)

## 数据

- `role='database'`
- attributes：`{ schema: FieldDef[], icon? }`
- 行 = `parent_id` 指向 database 的 Item
- schema 字段类型：string/number/unity_name

## 显示

- 表格式 list；
- 行编辑通过 updateItem；
- 新建行 role 默认 page（按字段 schema）；
- 系统配置 database 使用同一模型。

## 编辑器边界

database 是 block/Item，但不是 TextBlock；它不参与 text 快捷键。`blockCanDelete` 对容器有保护，批量删除另走结构删除。

## 相关

- [Database spec](../../item/05-database.md)
- [Item model](../../item/01-data-model.md)
