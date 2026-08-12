from django.db import migrations, models

import planner.models


class Migration(migrations.Migration):
    dependencies = [
        ("planner", "0004_calendarconnection_sync_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="adaptation_state",
            field=models.JSONField(default=planner.models.default_adaptation_state),
        ),
        migrations.AddField(
            model_name="feedback",
            name="sleep_onset_delay_minutes",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="feedback",
            name="nap_duration_minutes",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="feedback",
            name="nap_reason",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="feedback",
            name="recommendation_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
