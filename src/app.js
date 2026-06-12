const express = require("express");
const { db, initDB } = require("./db");
const seedData = require("./seed");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const STATUS = {
  IN_STOCK: "in_stock",
  TESTING: "testing",
  PEST_ISOLATED: "pest_isolated",
  SHIPPED_OUT: "shipped_out",
  SCRAPPED: "scrapped",
};

const STATUS_LABELS = {
  in_stock: "在库",
  testing: "检测中",
  pest_isolated: "虫害隔离",
  shipped_out: "已出库",
  scrapped: "已报废",
};

const REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const REQUEST_STATUS_LABELS = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
};

function addRequestStatusLabel(req) {
  if (req) {
    req.status_label = REQUEST_STATUS_LABELS[req.status] || req.status;
  }
  return req;
}

function generateRequestNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts =
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `YM-${ts}-${rand}`;
}

function addStatusLabel(batch) {
  if (batch) {
    batch.status_label = STATUS_LABELS[batch.status] || batch.status;
  }
  return batch;
}

function updateBatchTimestamp(id) {
  db.prepare(
    `UPDATE seed_batches SET updated_at = datetime('now', 'localtime') WHERE id = ?`,
  ).run(id);
}

app.get("/api/batches", (req, res) => {
  const { status, year, mother_tree, page = 1, page_size = 20 } = req.query;
  let where = [];
  let params = [];

  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (year) {
    where.push("collection_year = ?");
    params.push(Number(year));
  }
  if (mother_tree) {
    where.push("mother_tree LIKE ?");
    params.push(`%${mother_tree}%`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const offset = (page - 1) * page_size;

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM seed_batches ${whereSql}`)
    .get(...params).count;
  const rows = db
    .prepare(
      `SELECT * FROM seed_batches ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, Number(page_size), offset);

  res.json({
    total,
    page: Number(page),
    page_size: Number(page_size),
    list: rows.map(addStatusLabel),
  });
});

app.get("/api/batches/:id", (req, res) => {
  const batch = db
    .prepare("SELECT * FROM seed_batches WHERE id = ?")
    .get(req.params.id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });
  res.json(addStatusLabel(batch));
});

app.post("/api/batches", (req, res) => {
  const {
    batch_no,
    mother_tree,
    collection_year,
    purity,
    thousand_grain_weight,
    storage_weight,
    storage_location,
    storage_conditions,
  } = req.body;

  if (
    !batch_no ||
    !mother_tree ||
    !collection_year ||
    purity === undefined ||
    thousand_grain_weight === undefined ||
    storage_weight === undefined ||
    !storage_location ||
    !storage_conditions
  ) {
    return res.status(400).json({ error: "缺少必填字段" });
  }

  try {
    const info = db
      .prepare(
        `
      INSERT INTO seed_batches (batch_no, mother_tree, collection_year, purity,
        thousand_grain_weight, storage_weight, current_weight,
        storage_location, storage_conditions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        batch_no,
        mother_tree,
        collection_year,
        purity,
        thousand_grain_weight,
        storage_weight,
        storage_weight,
        storage_location,
        storage_conditions,
        STATUS.IN_STOCK,
      );

    const batch = db
      .prepare("SELECT * FROM seed_batches WHERE id = ?")
      .get(info.lastInsertRowid);
    res.status(201).json(addStatusLabel(batch));
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.status(400).json({ error: "批次号已存在" });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.put("/api/batches/:id", (req, res) => {
  const existing = db
    .prepare("SELECT * FROM seed_batches WHERE id = ?")
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: "批次不存在" });

  const {
    mother_tree,
    collection_year,
    purity,
    thousand_grain_weight,
    storage_location,
    storage_conditions,
    status,
  } = req.body;

  const updated = { ...existing, ...req.body };
  db.prepare(
    `
    UPDATE seed_batches SET
      mother_tree = ?, collection_year = ?, purity = ?,
      thousand_grain_weight = ?, storage_location = ?,
      storage_conditions = ?, status = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `,
  ).run(
    updated.mother_tree,
    updated.collection_year,
    updated.purity,
    updated.thousand_grain_weight,
    updated.storage_location,
    updated.storage_conditions,
    updated.status,
    req.params.id,
  );

  const batch = db
    .prepare("SELECT * FROM seed_batches WHERE id = ?")
    .get(req.params.id);
  res.json(addStatusLabel(batch));
});

app.delete("/api/batches/:id", (req, res) => {
  const info = db
    .prepare("DELETE FROM seed_batches WHERE id = ?")
    .run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "批次不存在" });
  res.json({ message: "删除成功" });
});

app.post("/api/batches/:id/inspect", (req, res) => {
  const { id } = req.params;
  const { inspection_type, germination_rate, has_pest, inspector, notes } =
    req.body;

  const batch = db.prepare("SELECT * FROM seed_batches WHERE id = ?").get(id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });

  if (!["germination", "pest", "full"].includes(inspection_type)) {
    return res
      .status(400)
      .json({ error: "检测类型无效，可选: germination, pest, full" });
  }

  const tx = db.transaction(() => {
    let newStatus = batch.status;
    let germRate = batch.germination_rate;

    if (inspection_type === "germination" || inspection_type === "full") {
      if (germination_rate === undefined) {
        throw new Error("发芽率检测需要提供 germination_rate");
      }
      germRate = germination_rate;
      db.prepare(
        `
        INSERT INTO inspections (batch_id, inspection_type, germination_rate, inspector, notes)
        VALUES (?, 'germination', ?, ?, ?)
      `,
      ).run(id, germination_rate, inspector || null, notes || null);
    }

    if (inspection_type === "pest" || inspection_type === "full") {
      if (has_pest === undefined) {
        throw new Error("虫害检测需要提供 has_pest");
      }
      db.prepare(
        `
        INSERT INTO inspections (batch_id, inspection_type, has_pest, inspector, notes)
        VALUES (?, 'pest', ?, ?, ?)
      `,
      ).run(id, has_pest ? 1 : 0, inspector || null, notes || null);

      if (has_pest) {
        newStatus = STATUS.PEST_ISOLATED;
      } else if (
        batch.status === STATUS.PEST_ISOLATED ||
        batch.status === STATUS.TESTING
      ) {
        newStatus = STATUS.IN_STOCK;
      }
    }

    if (inspection_type === "full" && batch.status === STATUS.TESTING) {
      if (!has_pest) newStatus = STATUS.IN_STOCK;
    }

    db.prepare(
      `
      UPDATE seed_batches SET
        status = ?, germination_rate = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `,
    ).run(newStatus, germRate, id);

    return { newStatus, germRate };
  });

  try {
    const result = tx();
    const updated = db
      .prepare("SELECT * FROM seed_batches WHERE id = ?")
      .get(id);
    res.json({
      message: has_pest ? "检测出虫害，已自动转入隔离状态" : "检测完成",
      batch: addStatusLabel(updated),
      pest_isolated: result.newStatus === STATUS.PEST_ISOLATED,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/batches/:id/fumigate", (req, res) => {
  const { id } = req.params;
  const { method, duration_hours, operator, notes } = req.body;

  const batch = db.prepare("SELECT * FROM seed_batches WHERE id = ?").get(id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });

  if (!method || !duration_hours) {
    return res.status(400).json({ error: "缺少熏蒸方法或时长" });
  }

  const info = db
    .prepare(
      `
    INSERT INTO fumigations (batch_id, method, duration_hours, operator, notes)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(id, method, duration_hours, operator || null, notes || null);

  updateBatchTimestamp(id);

  const fumigation = db
    .prepare("SELECT * FROM fumigations WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json({
    message: "熏蒸处理记录已创建",
    fumigation,
  });
});

app.post("/api/batches/:id/reinspect", (req, res) => {
  const { id } = req.params;
  const { has_pest, germination_rate, inspector, notes } = req.body;

  const batch = db.prepare("SELECT * FROM seed_batches WHERE id = ?").get(id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });

  if (batch.status !== STATUS.PEST_ISOLATED) {
    return res.status(400).json({ error: "只有虫害隔离状态的批次才能复检" });
  }

  if (has_pest === undefined) {
    return res.status(400).json({ error: "请提供复检结果 has_pest" });
  }

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO inspections (batch_id, inspection_type, has_pest, germination_rate, inspector, notes)
      VALUES (?, 'reinspection', ?, ?, ?, ?)
    `,
    ).run(
      id,
      has_pest ? 1 : 0,
      germination_rate || null,
      inspector || null,
      notes || null,
    );

    const newStatus = has_pest ? STATUS.SCRAPPED : STATUS.IN_STOCK;
    const germRate =
      germination_rate !== undefined
        ? germination_rate
        : batch.germination_rate;

    db.prepare(
      `
      UPDATE seed_batches SET
        status = ?, germination_rate = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `,
    ).run(newStatus, germRate, id);

    return newStatus;
  });

  try {
    const newStatus = tx();
    const updated = db
      .prepare("SELECT * FROM seed_batches WHERE id = ?")
      .get(id);
    res.json({
      message: has_pest ? "复检不合格，批次已报废" : "复检合格，已转回在库状态",
      batch: addStatusLabel(updated),
      new_status: newStatus,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/batches/:id/outbound", (req, res) => {
  const { id } = req.params;
  const { quantity, purpose, recipient, operator, notes } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "出库数量必须大于0" });
  }
  if (!purpose) {
    return res.status(400).json({ error: "请填写出库用途" });
  }

  const batch = db.prepare("SELECT * FROM seed_batches WHERE id = ?").get(id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });

  if (batch.status !== STATUS.IN_STOCK) {
    return res
      .status(400)
      .json({ error: `当前状态为"${STATUS_LABELS[batch.status]}"，无法出库` });
  }

  if (quantity > batch.current_weight) {
    return res.status(400).json({
      error: `库存不足，当前库存 ${batch.current_weight} kg，无法出库 ${quantity} kg`,
    });
  }

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO outbound_records (batch_id, quantity, purpose, recipient, operator, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      quantity,
      purpose,
      recipient || null,
      operator || null,
      notes || null,
    );

    const newWeight = batch.current_weight - quantity;
    let newStatus = batch.status;
    if (newWeight <= 0) {
      newStatus = STATUS.SHIPPED_OUT;
    }

    db.prepare(
      `
      UPDATE seed_batches SET
        current_weight = ?, status = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `,
    ).run(newWeight, newStatus, id);

    return { newWeight, newStatus };
  });

  try {
    const result = tx();
    const updated = db
      .prepare("SELECT * FROM seed_batches WHERE id = ?")
      .get(id);
    res.json({
      message: "出库成功",
      batch: addStatusLabel(updated),
      remaining_weight: result.newWeight,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/batches/:id/inspections", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM inspections WHERE batch_id = ? ORDER BY id DESC")
    .all(req.params.id);
  res.json({ list: rows });
});

app.get("/api/batches/:id/fumigations", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM fumigations WHERE batch_id = ? ORDER BY id DESC")
    .all(req.params.id);
  res.json({ list: rows });
});

app.get("/api/batches/:id/outbound-records", (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM outbound_records WHERE batch_id = ? ORDER BY id DESC",
    )
    .all(req.params.id);
  res.json({ list: rows });
});

app.get("/api/stats/by-year", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT
      collection_year as year,
      COUNT(*) as total_batches,
      SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_batches,
      SUM(CASE WHEN status = 'in_stock' THEN current_weight ELSE 0 END) as total_in_stock_weight,
      AVG(CASE WHEN status = 'in_stock' AND germination_rate IS NOT NULL THEN germination_rate END) as avg_germination_rate,
      SUM(CASE WHEN status = 'pest_isolated' OR status = 'scrapped' THEN 1 ELSE 0 END) as pest_related_batches,
      ROUND(
        CAST(SUM(CASE WHEN status = 'pest_isolated' OR status = 'scrapped' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100,
        2
      ) as pest_ratio_percent
    FROM seed_batches
    GROUP BY collection_year
    ORDER BY collection_year DESC
  `,
    )
    .all();

  res.json({ list: rows });
});

app.get("/api/stats/by-mother-tree", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT
      mother_tree,
      COUNT(*) as total_batches,
      SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_batches,
      SUM(CASE WHEN status = 'in_stock' THEN current_weight ELSE 0 END) as total_in_stock_weight,
      AVG(CASE WHEN status = 'in_stock' AND germination_rate IS NOT NULL THEN germination_rate END) as avg_germination_rate,
      SUM(CASE WHEN status = 'pest_isolated' OR status = 'scrapped' THEN 1 ELSE 0 END) as pest_related_batches,
      ROUND(
        CAST(SUM(CASE WHEN status = 'pest_isolated' OR status = 'scrapped' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100,
        2
      ) as pest_ratio_percent
    FROM seed_batches
    GROUP BY mother_tree
    ORDER BY total_batches DESC
  `,
    )
    .all();

  res.json({ list: rows });
});

app.get("/api/stats/summary", (req, res) => {
  const total = db
    .prepare(
      "SELECT COUNT(*) as count, SUM(current_weight) as weight FROM seed_batches",
    )
    .get();
  const byStatus = db
    .prepare(
      `
    SELECT status, COUNT(*) as count, SUM(current_weight) as weight
    FROM seed_batches GROUP BY status
  `,
    )
    .all();

  const statusMap = {};
  byStatus.forEach((s) => {
    statusMap[s.status] = {
      count: s.count,
      weight: s.weight || 0,
      label: STATUS_LABELS[s.status] || s.status,
    };
  });

  res.json({
    total_batches: total.count,
    total_weight: total.weight || 0,
    by_status: statusMap,
  });
});

app.get("/api/seedling-requests", (req, res) => {
  const {
    status,
    requesting_unit,
    purpose,
    batch_id,
    page = 1,
    page_size = 20,
  } = req.query;
  let where = [];
  let params = [];

  if (status) {
    where.push("sr.status = ?");
    params.push(status);
  }
  if (requesting_unit) {
    where.push("sr.requesting_unit LIKE ?");
    params.push(`%${requesting_unit}%`);
  }
  if (purpose) {
    where.push("sr.purpose LIKE ?");
    params.push(`%${purpose}%`);
  }
  if (batch_id) {
    where.push("sr.batch_id = ?");
    params.push(Number(batch_id));
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const offset = (page - 1) * page_size;

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM seedling_requests sr ${whereSql}`)
    .get(...params).count;

  const rows = db
    .prepare(
      `
      SELECT sr.*, sb.batch_no, sb.mother_tree, sb.current_weight as batch_current_weight,
             sb.status as batch_status
      FROM seedling_requests sr
      LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
      ${whereSql}
      ORDER BY sr.id DESC LIMIT ? OFFSET ?
      `,
    )
    .all(...params, Number(page_size), offset);

  res.json({
    total,
    page: Number(page),
    page_size: Number(page_size),
    list: rows.map((r) => {
      const req = addRequestStatusLabel(r);
      req.batch_status_label = STATUS_LABELS[r.batch_status] || r.batch_status;
      return req;
    }),
  });
});

app.get("/api/seedling-requests/:id", (req, res) => {
  const row = db
    .prepare(
      `
      SELECT sr.*, sb.batch_no, sb.mother_tree, sb.current_weight as batch_current_weight,
             sb.storage_weight, sb.storage_location, sb.status as batch_status,
             sb.germination_rate, sb.purity, sb.thousand_grain_weight
      FROM seedling_requests sr
      LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
      WHERE sr.id = ?
      `,
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "领用申请不存在" });

  const result = addRequestStatusLabel(row);
  result.batch_status_label =
    STATUS_LABELS[row.batch_status] || row.batch_status;

  if (row.outbound_record_id) {
    result.outbound_record = db
      .prepare("SELECT * FROM outbound_records WHERE id = ?")
      .get(row.outbound_record_id);
  }

  res.json(result);
});

app.post("/api/seedling-requests", (req, res) => {
  const {
    batch_id,
    requesting_unit,
    applicant,
    quantity,
    purpose,
    purpose_detail,
    planned_use_date,
  } = req.body;

  if (!batch_id || !requesting_unit || !applicant || !quantity || !purpose) {
    return res.status(400).json({
      error: "缺少必填字段：批次ID、领用单位、申请人、数量、用途",
    });
  }
  if (quantity <= 0) {
    return res.status(400).json({ error: "领用数量必须大于0" });
  }

  const batch = db
    .prepare("SELECT * FROM seed_batches WHERE id = ?")
    .get(batch_id);
  if (!batch) return res.status(404).json({ error: "批次不存在" });

  if (batch.status !== STATUS.IN_STOCK) {
    return res.status(400).json({
      error: `批次当前状态为"${STATUS_LABELS[batch.status]}"，无法提交领用申请`,
    });
  }

  if (quantity > batch.current_weight) {
    return res.status(400).json({
      error: `库存不足，当前库存 ${batch.current_weight} kg，申请 ${quantity} kg`,
    });
  }

  const request_no = generateRequestNo();

  try {
    const info = db
      .prepare(
        `
        INSERT INTO seedling_requests
          (request_no, batch_id, requesting_unit, applicant, quantity,
           purpose, purpose_detail, planned_use_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        request_no,
        batch_id,
        requesting_unit,
        applicant,
        quantity,
        purpose,
        purpose_detail || null,
        planned_use_date || null,
        REQUEST_STATUS.PENDING,
      );

    const row = db
      .prepare(
        `
        SELECT sr.*, sb.batch_no, sb.mother_tree
        FROM seedling_requests sr
        LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
        WHERE sr.id = ?
        `,
      )
      .get(info.lastInsertRowid);

    res.status(201).json({
      message: "领用申请已提交，等待审批",
      request: addRequestStatusLabel(row),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/seedling-requests/:id/approve", (req, res) => {
  const { id } = req.params;
  const { approver, approval_notes, operator } = req.body;

  const request = db
    .prepare("SELECT * FROM seedling_requests WHERE id = ?")
    .get(id);
  if (!request) return res.status(404).json({ error: "领用申请不存在" });

  if (request.status !== REQUEST_STATUS.PENDING) {
    return res.status(400).json({
      error: `当前申请状态为"${REQUEST_STATUS_LABELS[request.status]}"，无法审批`,
    });
  }

  const batch = db
    .prepare("SELECT * FROM seed_batches WHERE id = ?")
    .get(request.batch_id);
  if (!batch) return res.status(404).json({ error: "关联批次不存在" });

  if (batch.status !== STATUS.IN_STOCK) {
    return res.status(400).json({
      error: `批次当前状态为"${STATUS_LABELS[batch.status]}"，无法审批通过出库`,
    });
  }

  if (request.quantity > batch.current_weight) {
    return res.status(400).json({
      error: `库存不足，当前库存 ${batch.current_weight} kg，申请 ${request.quantity} kg`,
    });
  }

  const tx = db.transaction(() => {
    const obInfo = db
      .prepare(
        `
        INSERT INTO outbound_records
          (batch_id, quantity, purpose, recipient, operator, notes, seedling_request_id, source_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'seedling_request')
        `,
      )
      .run(
        request.batch_id,
        request.quantity,
        request.purpose,
        request.requesting_unit,
        operator || approver || null,
        approval_notes || null,
        request.id,
      );

    const newWeight = batch.current_weight - request.quantity;
    let newStatus = batch.status;
    if (newWeight <= 0) {
      newStatus = STATUS.SHIPPED_OUT;
    }

    db.prepare(
      `
      UPDATE seed_batches SET
        current_weight = ?, status = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
      `,
    ).run(newWeight, newStatus, request.batch_id);

    db.prepare(
      `
      UPDATE seedling_requests SET
        status = ?, approver = ?, approval_notes = ?,
        approved_at = datetime('now', 'localtime'),
        outbound_record_id = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
      `,
    ).run(
      REQUEST_STATUS.APPROVED,
      approver || null,
      approval_notes || null,
      obInfo.lastInsertRowid,
      request.id,
    );

    return {
      outbound_id: obInfo.lastInsertRowid,
      new_weight: newWeight,
      new_status: newStatus,
    };
  });

  try {
    const result = tx();
    const updated = db
      .prepare(
        `
        SELECT sr.*, sb.batch_no, sb.mother_tree, sb.current_weight, sb.status as batch_status
        FROM seedling_requests sr
        LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
        WHERE sr.id = ?
        `,
      )
      .get(id);

    const resp = addRequestStatusLabel(updated);
    resp.batch_status_label =
      STATUS_LABELS[updated.batch_status] || updated.batch_status;
    resp.outbound_record_id = result.outbound_id;

    res.json({
      message: "审批通过，已自动出库并扣减库存",
      request: resp,
      remaining_weight: result.new_weight,
      outbound_record_id: result.outbound_id,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/seedling-requests/:id/reject", (req, res) => {
  const { id } = req.params;
  const { approver, reject_reason } = req.body;

  const request = db
    .prepare("SELECT * FROM seedling_requests WHERE id = ?")
    .get(id);
  if (!request) return res.status(404).json({ error: "领用申请不存在" });

  if (request.status !== REQUEST_STATUS.PENDING) {
    return res.status(400).json({
      error: `当前申请状态为"${REQUEST_STATUS_LABELS[request.status]}"，无法驳回`,
    });
  }

  if (!reject_reason) {
    return res.status(400).json({ error: "请填写驳回原因" });
  }

  db.prepare(
    `
    UPDATE seedling_requests SET
      status = ?, approver = ?, reject_reason = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
    `,
  ).run(REQUEST_STATUS.REJECTED, approver || null, reject_reason, id);

  const updated = db
    .prepare(
      `
      SELECT sr.*, sb.batch_no, sb.mother_tree
      FROM seedling_requests sr
      LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
      WHERE sr.id = ?
      `,
    )
    .get(id);

  res.json({
    message: "申请已驳回，库存未变动",
    request: addRequestStatusLabel(updated),
  });
});

app.get("/api/seedling-ledger", (req, res) => {
  const {
    requesting_unit,
    purpose,
    batch_id,
    start_date,
    end_date,
    page = 1,
    page_size = 20,
  } = req.query;

  let where = ["ob.source_type = 'seedling_request'"];
  let params = [];

  if (requesting_unit) {
    where.push("sr.requesting_unit LIKE ?");
    params.push(`%${requesting_unit}%`);
  }
  if (purpose) {
    where.push("sr.purpose LIKE ?");
    params.push(`%${purpose}%`);
  }
  if (batch_id) {
    where.push("ob.batch_id = ?");
    params.push(Number(batch_id));
  }
  if (start_date) {
    where.push("ob.outbound_date >= ?");
    params.push(start_date);
  }
  if (end_date) {
    where.push("ob.outbound_date <= ?");
    params.push(end_date + " 23:59:59");
  }

  const whereSql = "WHERE " + where.join(" AND ");
  const offset = (page - 1) * page_size;

  const total = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM outbound_records ob
      LEFT JOIN seedling_requests sr ON ob.seedling_request_id = sr.id
      ${whereSql}
      `,
    )
    .get(...params).count;

  const rows = db
    .prepare(
      `
      SELECT
        ob.id as outbound_id,
        ob.batch_id,
        ob.quantity,
        ob.purpose,
        ob.recipient,
        ob.operator,
        ob.outbound_date,
        ob.notes as outbound_notes,
        ob.seedling_request_id,
        sr.request_no,
        sr.requesting_unit,
        sr.applicant,
        sr.purpose_detail,
        sr.planned_use_date,
        sr.approver,
        sr.approval_notes,
        sr.approved_at,
        sb.batch_no,
        sb.mother_tree,
        sb.collection_year
      FROM outbound_records ob
      LEFT JOIN seedling_requests sr ON ob.seedling_request_id = sr.id
      LEFT JOIN seed_batches sb ON ob.batch_id = sb.id
      ${whereSql}
      ORDER BY ob.id DESC LIMIT ? OFFSET ?
      `,
    )
    .all(...params, Number(page_size), offset);

  const totalQuantity = db
    .prepare(
      `
      SELECT COALESCE(SUM(ob.quantity), 0) as total_quantity
      FROM outbound_records ob
      LEFT JOIN seedling_requests sr ON ob.seedling_request_id = sr.id
      ${whereSql}
      `,
    )
    .get(...params).total_quantity;

  res.json({
    total,
    page: Number(page),
    page_size: Number(page_size),
    total_quantity: totalQuantity,
    list: rows,
  });
});

app.get("/api/stats/seedling-by-unit", (req, res) => {
  const { start_date, end_date } = req.query;
  let where = ["sr.status = 'approved'"];
  let params = [];

  if (start_date) {
    where.push("sr.approved_at >= ?");
    params.push(start_date);
  }
  if (end_date) {
    where.push("sr.approved_at <= ?");
    params.push(end_date + " 23:59:59");
  }
  const whereSql = "WHERE " + where.join(" AND ");

  const rows = db
    .prepare(
      `
      SELECT
        sr.requesting_unit as unit,
        COUNT(*) as request_count,
        SUM(sr.quantity) as total_quantity,
        COUNT(DISTINCT sr.batch_id) as affected_batches,
        ROUND(AVG(sr.quantity), 2) as avg_quantity_per_request,
        MIN(sr.approved_at) as first_approved_at,
        MAX(sr.approved_at) as last_approved_at
      FROM seedling_requests sr
      ${whereSql}
      GROUP BY sr.requesting_unit
      ORDER BY total_quantity DESC
      `,
    )
    .all(...params);

  const grandTotal = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(quantity), 0) as grand_total_quantity,
        COUNT(DISTINCT batch_id) as total_affected_batches
      FROM seedling_requests sr
      ${whereSql}
      `,
    )
    .get(...params);

  res.json({
    summary: grandTotal,
    list: rows,
  });
});

app.get("/api/stats/seedling-by-purpose", (req, res) => {
  const { start_date, end_date } = req.query;
  let where = ["sr.status = 'approved'"];
  let params = [];

  if (start_date) {
    where.push("sr.approved_at >= ?");
    params.push(start_date);
  }
  if (end_date) {
    where.push("sr.approved_at <= ?");
    params.push(end_date + " 23:59:59");
  }
  const whereSql = "WHERE " + where.join(" AND ");

  const rows = db
    .prepare(
      `
      SELECT
        sr.purpose,
        COUNT(*) as request_count,
        SUM(sr.quantity) as total_quantity,
        COUNT(DISTINCT sr.requesting_unit) as involved_units,
        COUNT(DISTINCT sr.batch_id) as affected_batches,
        ROUND(AVG(sr.quantity), 2) as avg_quantity_per_request
      FROM seedling_requests sr
      ${whereSql}
      GROUP BY sr.purpose
      ORDER BY total_quantity DESC
      `,
    )
    .all(...params);

  const purposeDetails = db
    .prepare(
      `
      SELECT
        sr.purpose,
        sr.purpose_detail,
        COUNT(*) as request_count,
        SUM(sr.quantity) as total_quantity
      FROM seedling_requests sr
      ${whereSql}
      GROUP BY sr.purpose, sr.purpose_detail
      ORDER BY sr.purpose, total_quantity DESC
      `,
    )
    .all(...params);

  const grandTotal = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(quantity), 0) as grand_total_quantity,
        COUNT(DISTINCT purpose) as total_purposes
      FROM seedling_requests sr
      ${whereSql}
      `,
    )
    .get(...params);

  res.json({
    summary: grandTotal,
    by_purpose: rows,
    by_purpose_detail: purposeDetails,
  });
});

app.get("/api/batches/:id/seedling-requests", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT sr.*, sb.batch_no
      FROM seedling_requests sr
      LEFT JOIN seed_batches sb ON sr.batch_id = sb.id
      WHERE sr.batch_id = ?
      ORDER BY sr.id DESC
      `,
    )
    .all(req.params.id);
  res.json({ list: rows.map(addRequestStatusLabel) });
});

app.get("/api/request-status-options", (req, res) => {
  res.json(
    Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  );
});

app.get("/api/status-options", (req, res) => {
  res.json(
    Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  );
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "服务器内部错误" });
});

initDB();
seedData();

app.listen(PORT, () => {
  console.log(`种质资源保存管理系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 前缀: /api`);
});

module.exports = app;
