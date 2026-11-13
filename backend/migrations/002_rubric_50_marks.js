/**
 * Migration 002: Update Evaluation Rubric to 5 criteria x 10 marks = 50 per judge
 * RMK Junior Hackathon 2026
 *
 * Rubric:
 * C1: Problem Relevance & Scope (10 marks)
 * C2: Innovation & Creativity (10 marks)
 * C3: Technical Feasibility & Architecture (10 marks)
 * C4: Impact & Practical Utility (10 marks)
 * C5: Demonstration & Presentation (10 marks)
 * Total per judge: 50 marks. Combined score (Internal + External): 100 marks.
 */

async function up(pool) {
  console.log('[MIGRATION 002] Updating evaluation rubric to 5 criteria x 10 marks = 50 max...');

  const criteria = [
    {
      code: 'C1',
      title: 'Problem Relevance & Scope',
      desc: 'Understanding of the chosen domain, depth of research, and significance of the problem tackled.',
      max_score: 10.00,
      order: 1
    },
    {
      code: 'C2',
      title: 'Innovation & Creativity',
      desc: 'Novelty of the approach, uniqueness of solution, and creativity over conventional methods.',
      max_score: 10.00,
      order: 2
    },
    {
      code: 'C3',
      title: 'Technical Feasibility & Architecture',
      desc: 'Soundness of technical implementation, tool/technology stack choices, and architectural viability.',
      max_score: 10.00,
      order: 3
    },
    {
      code: 'C4',
      title: 'Impact & Practical Utility',
      desc: 'Real-world applicability, scalability, target user benefit, and execution sustainability.',
      max_score: 10.00,
      order: 4
    },
    {
      code: 'C5',
      title: 'Demonstration & Presentation',
      desc: 'Quality of working model/prototype demo, structured pitch, and clarity during Q&A interaction.',
      max_score: 10.00,
      order: 5
    }
  ];

  for (const c of criteria) {
    await pool.execute(`
      UPDATE jury_evaluation_criteria
      SET title = ?, description = ?, max_score = ?, display_order = ?, is_active = TRUE
      WHERE criterion_code = ?
    `, [c.title, c.desc, c.max_score, c.order, c.code]);
  }

  console.log('[MIGRATION 002] All 5 criteria updated to 10 marks each successfully.');
}

async function down(pool) {
  console.log('[MIGRATION 002] Rolling back criteria max_score to 20...');
  await pool.execute('UPDATE jury_evaluation_criteria SET max_score = 20.00 WHERE criterion_code IN (\'C1\', \'C2\', \'C3\', \'C4\', \'C5\')');
}

module.exports = { up, down };

