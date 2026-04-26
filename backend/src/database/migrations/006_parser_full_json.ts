import { Knex } from 'knex';

/**
 * Adds full new-JSON support to parser tables:
 *  - EnvVars (parser_env_vars + relations + hits + values)
 *  - ToolsetVars (parser_toolset_vars + parser_toolset_switch_opts)
 *  - Extra fields on existing parser_define_vars / parser_define_var_hits / parser_processed_files / parser_included_files
 *  - project_id / build_id / module_id on parser_sessions plus rollup totals
 */
export async function up(knex: Knex): Promise<void> {
  // ── parser_sessions: associations + rollups ──
  await knex.schema.alterTable('parser_sessions', (table) => {
    table.string('project_id', 36).nullable();
    table.string('build_id', 36).nullable();
    table.string('module_id', 100).nullable();
    table.integer('total_env_vars').defaultTo(0);
    table.integer('total_toolset_vars').defaultTo(0);
  });

  // ── parser_processed_files: keyed by FileType + extra counters ──
  await knex.schema.alterTable('parser_processed_files', (table) => {
    table.string('file_type_key', 20).nullable();
    table.integer('comp_opt_def').defaultTo(0);
    table.integer('comp_opt_inc').defaultTo(0);
  });

  // ── parser_included_files: track parser type (MOFP / CSHFP) ──
  await knex.schema.alterTable('parser_included_files', (table) => {
    table.string('include_type', 20).defaultTo('MOFP'); // MOFP | CSHFP
  });

  // ── parser_define_vars: enriched with HitSrc / VarScope / ValProp / flags ──
  await knex.schema.alterTable('parser_define_vars', (table) => {
    table.string('first_hit_src', 100).nullable();
    table.string('first_hit_var_scope', 100).nullable();
    table.string('first_hit_val_prop', 50).nullable();
    table.integer('first_hit_flags').defaultTo(0);
    table.string('last_hit_slnr', 500).nullable();
  });

  await knex.schema.alterTable('parser_define_var_hits', (table) => {
    table.string('hit_src', 100).nullable();
    table.string('var_scope', 100).nullable();
    table.string('val_prop', 50).nullable();
    table.integer('hit_flags').defaultTo(0);
    table.integer('cond_ord_depth').nullable();
    table.string('cond_ord_dir', 50).nullable();
    table.string('cond_ord_slnr', 500).nullable();
  });

  // ═══ EnvVars ═══
  await knex.schema.createTable('parser_env_vars', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('session_id').notNullable().references('id').inTable('parser_sessions').onDelete('CASCADE');
    table.string('var_name', 500).notNullable();
    table.string('first_hit_src', 100).nullable();
    table.string('first_hit_var_type', 100).nullable();
    table.string('first_hit_var_scope', 100).nullable();
    table.string('first_hit_val_prop', 50).nullable();
    table.string('first_hit_slnr', 500).nullable();
    table.string('last_hit_slnr', 500).nullable();
    table.integer('cond_ord_depth').nullable();
    table.string('cond_ord_dir', 50).nullable();
    table.string('cond_ord_slnr', 500).nullable();
    table.string('source_module', 100).nullable();
    table.string('source_file_name', 500).nullable();
    table.integer('source_line_number').nullable();
    table.timestamps(true, true);
    table.index(['session_id']);
    table.index(['var_name']);
  });

  await knex.schema.createTable('parser_env_var_relations', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('env_var_id').notNullable().references('id').inTable('parser_env_vars').onDelete('CASCADE');
    table.string('relation_type', 20).notNullable(); // parent | sibling | child | ref
    table.string('related_var_name', 500).notNullable();
    table.index(['env_var_id', 'relation_type']);
  });

  await knex.schema.createTable('parser_env_var_hits', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('env_var_id').notNullable().references('id').inTable('parser_env_vars').onDelete('CASCADE');
    table.string('hit_src', 100).nullable();
    table.string('var_type', 100).nullable();
    table.string('var_scope', 100).nullable();
    table.string('val_prop', 50).nullable();
    table.string('hit_slnr', 500).nullable();
    table.integer('cond_ord_depth').nullable();
    table.string('cond_ord_dir', 50).nullable();
    table.string('cond_ord_slnr', 500).nullable();
    table.string('source_file_name', 500).nullable();
    table.integer('source_line_number').nullable();
    table.string('source_module', 100).nullable();
    table.index(['env_var_id']);
  });

  await knex.schema.createTable('parser_env_var_values', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('env_var_id').notNullable().references('id').inTable('parser_env_vars').onDelete('CASCADE');
    table.string('value_key', 500).notNullable();
    table.jsonb('value_items').defaultTo('[]');
    table.index(['env_var_id']);
  });

  // ═══ ToolsetVars (CFLAGS etc.) ═══
  await knex.schema.createTable('parser_toolset_vars', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('session_id').notNullable().references('id').inTable('parser_sessions').onDelete('CASCADE');
    table.string('toolset_name', 100).notNullable();
    table.string('src_line_ref', 500).nullable();
    table.string('source_module', 100).nullable();
    table.timestamps(true, true);
    table.index(['session_id']);
  });

  await knex.schema.createTable('parser_toolset_switch_opts', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('toolset_var_id').notNullable().references('id').inTable('parser_toolset_vars').onDelete('CASCADE');
    table.string('switch_key', 20).notNullable(); // I, D, O, EL, W, ...
    table.string('opt_name', 500).notNullable();
    table.string('opt_source', 100).nullable();
    table.string('opt_value', 500).nullable();
    table.string('opt_line_ref', 500).nullable();
    table.index(['toolset_var_id']);
    table.index(['switch_key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('parser_toolset_switch_opts');
  await knex.schema.dropTableIfExists('parser_toolset_vars');
  await knex.schema.dropTableIfExists('parser_env_var_values');
  await knex.schema.dropTableIfExists('parser_env_var_hits');
  await knex.schema.dropTableIfExists('parser_env_var_relations');
  await knex.schema.dropTableIfExists('parser_env_vars');

  await knex.schema.alterTable('parser_define_var_hits', (table) => {
    table.dropColumn('hit_src');
    table.dropColumn('var_scope');
    table.dropColumn('val_prop');
    table.dropColumn('hit_flags');
    table.dropColumn('cond_ord_depth');
    table.dropColumn('cond_ord_dir');
    table.dropColumn('cond_ord_slnr');
  });
  await knex.schema.alterTable('parser_define_vars', (table) => {
    table.dropColumn('first_hit_src');
    table.dropColumn('first_hit_var_scope');
    table.dropColumn('first_hit_val_prop');
    table.dropColumn('first_hit_flags');
    table.dropColumn('last_hit_slnr');
  });
  await knex.schema.alterTable('parser_included_files', (table) => {
    table.dropColumn('include_type');
  });
  await knex.schema.alterTable('parser_processed_files', (table) => {
    table.dropColumn('file_type_key');
    table.dropColumn('comp_opt_def');
    table.dropColumn('comp_opt_inc');
  });
  await knex.schema.alterTable('parser_sessions', (table) => {
    table.dropColumn('project_id');
    table.dropColumn('build_id');
    table.dropColumn('module_id');
    table.dropColumn('total_env_vars');
    table.dropColumn('total_toolset_vars');
  });
}
