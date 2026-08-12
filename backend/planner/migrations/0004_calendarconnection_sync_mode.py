from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("planner", "0003_calendarconnection_selected_calendar_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="calendarconnection",
            name="sync_mode",
            field=models.CharField(
                choices=[("manual", "Manual"), ("auto", "Automatic")],
                default="manual",
                max_length=8,
            ),
        ),
    ]
