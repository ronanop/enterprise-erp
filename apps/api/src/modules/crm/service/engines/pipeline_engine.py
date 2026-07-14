"""Pipeline engine."""

from modules.crm.domain.exceptions import InvalidPipelineState
from modules.crm.models import CrmPipeline


class PipelineEngine:
    def validate_activatable(self, pipeline: CrmPipeline) -> None:
        if not pipeline.pipeline_name:
            raise InvalidPipelineState("Pipeline name is required")
