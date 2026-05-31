  import pool from "../../config/db.js";

  export const getQuestionsForUserService = async (location_id, category) => {
    // Lấy câu hỏi nhưng KHÔNG lấy trường explanation
    const questionsRes = await pool.query(
      `SELECT id, question_text, category 
      FROM questions 
      WHERE location_id = $1 AND category = $2 AND status = 'active'`,
      [location_id, category],
    );

    if (questionsRes.rows.length === 0) return [];

    const questions = questionsRes.rows;
    const questionIds = questions.map((q) => q.id);

    // Lấy đáp án nhưng KHÔNG lấy trường is_correct
    const answersRes = await pool.query(
      `SELECT id, question_id, option_label, answer_text 
      FROM answers 
      WHERE question_id = ANY($1) 
      ORDER BY option_label ASC`,
      [questionIds],
    );

    // Map đáp án lồng vào từng câu hỏi tương ứng
    return questions.map((q) => ({
      ...q,
      answers: answersRes.rows
        .filter((a) => a.question_id === q.id)
        .map((a) => ({
          id: a.id,
          option_label: a.option_label,
          answer_text: a.answer_text,
        })),
    }));
  };
