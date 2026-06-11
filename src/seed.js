const { db } = require("./db");

function seedData() {
  const count = db
    .prepare("SELECT COUNT(*) as count FROM seed_batches")
    .get().count;
  if (count > 0) return;

  const insertBatch = db.prepare(`
    INSERT INTO seed_batches
      (batch_no, mother_tree, collection_year, purity, thousand_grain_weight,
       storage_weight, current_weight, storage_location, storage_conditions,
       status, germination_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInspection = db.prepare(`
    INSERT INTO inspections (batch_id, inspection_type, germination_rate, has_pest, inspector, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertFumigation = db.prepare(`
    INSERT INTO fumigations (batch_id, method, duration_hours, operator, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertOutbound = db.prepare(`
    INSERT INTO outbound_records (batch_id, quantity, purpose, recipient, operator, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const batches = [
    {
      batch_no: "QH-2021-001",
      mother_tree: "祁连山大野口-12号优树",
      collection_year: 2021,
      purity: 96.5,
      thousand_grain_weight: 3.8,
      storage_weight: 50.0,
      current_weight: 50.0,
      storage_location: "A区-1架-3层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "in_stock",
      germination_rate: 82.5,
      inspections: [
        {
          type: "germination",
          rate: 82.5,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
      ],
    },
    {
      batch_no: "QH-2021-003",
      mother_tree: "祁连山大野口-12号优树",
      collection_year: 2021,
      purity: 95.2,
      thousand_grain_weight: 3.6,
      storage_weight: 30.0,
      current_weight: 30.0,
      storage_location: "A区-1架-4层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "pest_isolated",
      germination_rate: 78.0,
      inspections: [
        {
          type: "germination",
          rate: 78.0,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
        {
          type: "pest",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "例行检测发现豆象幼虫",
        },
      ],
      fumigations: [
        {
          method: "磷化铝熏蒸",
          hours: 72,
          operator: "赵工",
          notes: "首次熏蒸处理",
        },
      ],
    },
    {
      batch_no: "QH-2022-002",
      mother_tree: "互助北山林场-08号林分",
      collection_year: 2022,
      purity: 94.8,
      thousand_grain_weight: 3.5,
      storage_weight: 80.0,
      current_weight: 65.0,
      storage_location: "B区-2架-1层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "in_stock",
      germination_rate: 76.3,
      inspections: [
        {
          type: "germination",
          rate: 76.3,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
      ],
      outbounds: [
        {
          quantity: 15.0,
          purpose: "春季育苗",
          recipient: "孟达苗圃",
          operator: "库管员张",
          notes: "2023年春季育苗用种",
        },
      ],
    },
    {
      batch_no: "QH-2022-005",
      mother_tree: "互助北山林场-08号林分",
      collection_year: 2022,
      purity: 93.5,
      thousand_grain_weight: 3.7,
      storage_weight: 45.0,
      current_weight: 45.0,
      storage_location: "B区-2架-2层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "testing",
      germination_rate: null,
      inspections: [],
    },
    {
      batch_no: "QH-2020-001",
      mother_tree: "祁连山东峡-05号优树",
      collection_year: 2020,
      purity: 97.0,
      thousand_grain_weight: 4.0,
      storage_weight: 25.0,
      current_weight: 0.0,
      storage_location: "A区-3架-1层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "shipped_out",
      germination_rate: 85.0,
      inspections: [
        {
          type: "germination",
          rate: 85.0,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
      ],
      outbounds: [
        {
          quantity: 10.0,
          purpose: "造林试验",
          recipient: "西宁试验站",
          operator: "库管员张",
          notes: "2021年造林试验用种",
        },
        {
          quantity: 15.0,
          purpose: "苗木繁育",
          recipient: "大通苗圃",
          operator: "库管员张",
          notes: "2022年苗木繁育用种",
        },
      ],
    },
    {
      batch_no: "QH-2020-004",
      mother_tree: "祁连山东峡-05号优树",
      collection_year: 2020,
      purity: 92.0,
      thousand_grain_weight: 3.4,
      storage_weight: 20.0,
      current_weight: 20.0,
      storage_location: "C区-隔离室-1号",
      storage_conditions: "温度-18℃，相对湿度35%，单独隔离存放",
      status: "scrapped",
      germination_rate: 65.0,
      inspections: [
        {
          type: "germination",
          rate: 65.0,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
        {
          type: "pest",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "发现严重虫害",
        },
        {
          type: "reinspection",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "熏蒸后复检仍有活虫",
        },
      ],
      fumigations: [
        {
          method: "磷化铝熏蒸",
          hours: 96,
          operator: "赵工",
          notes: "强化熏蒸处理",
        },
      ],
    },
    {
      batch_no: "QH-2023-001",
      mother_tree: "麦秀林场-03号林分",
      collection_year: 2023,
      purity: 95.8,
      thousand_grain_weight: 3.9,
      storage_weight: 100.0,
      current_weight: 100.0,
      storage_location: "B区-1架-1层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "in_stock",
      germination_rate: 80.2,
      inspections: [
        {
          type: "full",
          rate: 80.2,
          pest: 0,
          inspector: "李技术员",
          notes: "入库全面检测",
        },
      ],
    },
    {
      batch_no: "QH-2023-004",
      mother_tree: "麦秀林场-03号林分",
      collection_year: 2023,
      purity: 91.5,
      thousand_grain_weight: 3.3,
      storage_weight: 60.0,
      current_weight: 60.0,
      storage_location: "C区-隔离室-2号",
      storage_conditions: "温度-18℃，相对湿度35%，单独隔离存放",
      status: "pest_isolated",
      germination_rate: 72.0,
      inspections: [
        {
          type: "germination",
          rate: 72.0,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
        {
          type: "pest",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "球果螟幼虫检出",
        },
      ],
      fumigations: [
        {
          method: "溴甲烷熏蒸",
          hours: 24,
          operator: "赵工",
          notes: "快速熏蒸处理",
        },
      ],
    },
    {
      batch_no: "QH-2022-007",
      mother_tree: "坎布拉林场-11号优树",
      collection_year: 2022,
      purity: 96.0,
      thousand_grain_weight: 3.85,
      storage_weight: 35.0,
      current_weight: 35.0,
      storage_location: "A区-2架-2层",
      storage_conditions: "温度-18℃，相对湿度35%",
      status: "in_stock",
      germination_rate: 83.7,
      inspections: [
        {
          type: "germination",
          rate: 83.7,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
      ],
    },
    {
      batch_no: "QH-2021-006",
      mother_tree: "坎布拉林场-11号优树",
      collection_year: 2021,
      purity: 94.0,
      thousand_grain_weight: 3.6,
      storage_weight: 28.0,
      current_weight: 28.0,
      storage_location: "C区-隔离室-3号",
      storage_conditions: "温度-18℃，相对湿度35%，单独隔离存放",
      status: "scrapped",
      germination_rate: 70.0,
      inspections: [
        {
          type: "germination",
          rate: 70.0,
          pest: 0,
          inspector: "李技术员",
          notes: "入库检测",
        },
        {
          type: "pest",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "虫害检出",
        },
        {
          type: "reinspection",
          rate: null,
          pest: 1,
          inspector: "王检测员",
          notes: "二次熏蒸后复检不合格",
        },
      ],
      fumigations: [
        {
          method: "磷化铝熏蒸",
          hours: 72,
          operator: "赵工",
          notes: "第一次熏蒸",
        },
        {
          method: "磷化铝熏蒸",
          hours: 96,
          operator: "赵工",
          notes: "第二次强化熏蒸",
        },
      ],
    },
  ];

  batches.forEach((b) => {
    const info = insertBatch.run(
      b.batch_no,
      b.mother_tree,
      b.collection_year,
      b.purity,
      b.thousand_grain_weight,
      b.storage_weight,
      b.current_weight,
      b.storage_location,
      b.storage_conditions,
      b.status,
      b.germination_rate,
    );
    const batchId = info.lastInsertRowid;

    (b.inspections || []).forEach((ins) => {
      insertInspection.run(
        batchId,
        ins.type,
        ins.rate,
        ins.pest,
        ins.inspector,
        ins.notes,
      );
    });

    (b.fumigations || []).forEach((fum) => {
      insertFumigation.run(
        batchId,
        fum.method,
        fum.hours,
        fum.operator,
        fum.notes,
      );
    });

    (b.outbounds || []).forEach((ob) => {
      insertOutbound.run(
        batchId,
        ob.quantity,
        ob.purpose,
        ob.recipient,
        ob.operator,
        ob.notes,
      );
    });
  });

  console.log(`已初始化 ${batches.length} 批种子数据`);
}

module.exports = seedData;
