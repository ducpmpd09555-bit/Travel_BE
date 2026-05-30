import pool from "../../config/db.js";

// ================= CREATE (WITH ANSWERS TRANSACTION) =================
export const createQuestionService = async (body) => {
  const { location_id, question_text, category, explanation, status, answers } =
    body;

  // Validate số lượng đáp án gửi lên
  if (!answers || answers.length !== 4) {
    throw {
      status: 400,
      message: "Một câu hỏi phải có chính xác 4 đáp án (A, B, C, D)",
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Chèn vào bảng questions
    const questionRes = await client.query(
      `INSERT INTO questions (location_id, question_text, category, explanation, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [location_id, question_text, category, explanation, status || "active"],
    );
    const newQuestion = questionRes.rows[0];

    // 2. Chèn 4 đáp án vào bảng answers
    const answerQueries = answers.map((ans) => {
      return client.query(
        `INSERT INTO answers (question_id, option_label, answer_text, is_correct)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          newQuestion.id,
          ans.option_label,
          ans.answer_text,
          ans.is_correct || false,
        ],
      );
    });
    const answerResults = await Promise.all(answerQueries);

    await client.query("COMMIT");

    return {
      ...newQuestion,
      answers: answerResults.map((r) => r.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ================= GET ALL (PAGINATION & FILTERS) =================
export const getAllQuestionsService = async (query) => {
  const { page = 1, limit = 10, search, category, location_id } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  if (location_id) {
    params.push(location_id);
    whereClauses.push(`location_id = $${params.length}`);
  }
  if (category) {
    params.push(category);
    whereClauses.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`question_text ILIKE $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM questions ${whereString}`,
    params,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const dataQuery = `
    SELECT * FROM questions 
    ${whereString} 
    ORDER BY created_at DESC 
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  return {
    questions: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================= GET BY ID (WITH ANSWERS) =================
export const getQuestionByIdService = async (id) => {
  const questionRes = await pool.query(
    "SELECT * FROM questions WHERE id = $1",
    [id],
  );
  if (questionRes.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy câu hỏi" };

  const answersRes = await pool.query(
    "SELECT id, option_label, answer_text, is_correct FROM answers WHERE question_id = $1 ORDER BY option_label ASC",
    [id],
  );

  return {
    ...questionRes.rows[0],
    answers: answersRes.rows,
  };
};

// ================= UPDATE QUESTION DETAILS =================
export const updateQuestionService = async (id, body) => {
  const { question_text, category, explanation, status } = body || {};

  const result = await pool.query(
    `UPDATE questions 
     SET 
       question_text = COALESCE($1, question_text),
       category = COALESCE($2, category),
       explanation = COALESCE($3, explanation),
       status = COALESCE($4, status),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 RETURNING *`,
    [question_text, category, explanation, status, id],
  );

  if (result.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy câu hỏi" };
  return result.rows[0];
};
