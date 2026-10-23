# Content production

Read the confirmed analysis and direction, plus your production draft to resume. If no project is
linked call production_create_project (reuses task project after resume). Write hook/body/CTA and
visual layout through editing tools; set actual topic/message metadata. Use production_import_image
to reuse an existing project asset or stored reference slide in an image placement; it imports
through the app and cleans temporary files. Use production_save_draft to save current content and
completed/remaining work. Reuse the linked project rather than creating another. All slide content
must be complete, natural English and actually reviewed. Call preview_slides for ALL slides at the
latest saved revision; read each resulting image, fix issues, then re-review affected slides. The
harness verifies real preview calls, revision and slide coverage. Save the actual final content and
deviation reasons in summary_json (JSON-encoded object), sources_json (JSON-encoded array),
project_id, reviewed_slide_ids and reviewed_revision. Do not register a publication or claim the
user uploaded it.
