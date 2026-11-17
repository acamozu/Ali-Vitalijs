*&---------------------------------------------------------------------*
*& Report ZCARPOOL_REGISTER
*&---------------------------------------------------------------------*
*& Registers the hand-written OData service of the carpool planner in
*& the backend, with the same API the transactions /IWBEP/REG_MODEL and
*& /IWBEP/REG_SERVICE use:
*&   model   ZCARPOOL_MDL 0001  ->  class ZCL_CARPOOL_MPC
*&   service ZCARPOOL_SRV 0001  ->  class ZCL_CARPOOL_DPC
*& Run once with F8. What already exists is left alone. Afterwards the
*& service shows up in /IWFND/MAINT_SERVICE -> Add Service.
*&---------------------------------------------------------------------*
REPORT zcarpool_register.

CONSTANTS: gc_model   TYPE /iwbep/med_mdl_technical_name VALUE 'ZCARPOOL_MDL',
           gc_service TYPE /iwbep/med_grp_technical_name VALUE 'ZCARPOOL_SRV',
           gc_version TYPE /iwbep/med_grp_version        VALUE '0001'.

DATA: gs_model   TYPE /iwbep/cl_mgw_med_reg_api=>ty_s_model,
      gs_service TYPE /iwbep/cl_mgw_med_reg_api=>ty_s_service,
      gt_models  TYPE /iwbep/cl_mgw_med_reg_api=>ty_t_models,
      gv_package TYPE devclass,
      gv_exists  TYPE abap_bool,
      gx_error   TYPE REF TO /iwbep/cx_mgw_med_exception.

START-OF-SELECTION.

  TRY.
      " ---------- model ----------
      TRY.
          /iwbep/cl_mgw_med_reg_api=>check_model_exists( iv_technical_name = gc_model iv_version = gc_version ).
          gv_exists = abap_true.
        CATCH /iwbep/cx_mgw_med_exception.
          gv_exists = abap_false.
      ENDTRY.
      IF gv_exists = abap_true.
        WRITE: / 'Model', gc_model, 'already exists - left alone.'.
      ELSE.
        gs_model-technical_name = gc_model.
        gs_model-version        = gc_version.
        gs_model-description    = 'Carpool planner'.
        gs_model-language       = sy-langu.
        gs_model-class_name     = 'ZCL_CARPOOL_MPC'.
        gs_model-created_by     = sy-uname.
        gv_package = '$TMP'.
        /iwbep/cl_mgw_med_reg_api=>create_model(
          EXPORTING is_model           = gs_model
                    iv_suppress_dialog = 'X'
          CHANGING  cv_package         = gv_package ).
        WRITE: / 'OK: model', gc_model, 'created.'.
      ENDIF.

      " ---------- service ----------
      TRY.
          /iwbep/cl_mgw_med_reg_api=>check_service_exists( iv_technical_name = gc_service iv_version = gc_version ).
          gv_exists = abap_true.
        CATCH /iwbep/cx_mgw_med_exception.
          gv_exists = abap_false.
      ENDTRY.
      IF gv_exists = abap_true.
        WRITE: / 'Service', gc_service, 'already exists - left alone.'.
      ELSE.
        gs_service-technical_name = gc_service.
        gs_service-version        = gc_version.
        gs_service-description    = 'Carpool planner'.
        gs_service-language       = sy-langu.
        gs_service-class_name     = 'ZCL_CARPOOL_DPC'.
        gs_service-created_by     = sy-uname.
        gv_package = '$TMP'.
        /iwbep/cl_mgw_med_reg_api=>create_service(
          EXPORTING is_service         = gs_service
                    iv_suppress_dialog = 'X'
          CHANGING  cv_package         = gv_package ).
        WRITE: / 'OK: service', gc_service, 'created.'.
      ENDIF.

      " ---------- model -> service ----------
      CLEAR: gs_service, gt_models.
      /iwbep/cl_mgw_med_reg_api=>get_service_details(
        EXPORTING iv_technical_name = gc_service
                  iv_version        = gc_version
        IMPORTING es_service        = gs_service
                  et_assigned_models = gt_models ).
      READ TABLE gt_models TRANSPORTING NO FIELDS WITH KEY technical_name = gc_model version = gc_version.
      IF sy-subrc = 0.
        WRITE: / 'Model is already assigned to the service - left alone.'.
      ELSE.
        /iwbep/cl_mgw_med_reg_api=>assign_model_to_service(
          iv_service_technical_name = gc_service
          iv_service_version        = gc_version
          iv_model_technical_name   = gc_model
          iv_model_version          = gc_version
          iv_suppress_dialog        = 'X' ).
        WRITE: / 'OK: model assigned to the service.'.
      ENDIF.

      COMMIT WORK.
      WRITE: / 'Done. Next: /IWFND/MAINT_SERVICE -> Add Service -> ZCARPOOL_SRV.'.

    CATCH /iwbep/cx_mgw_med_exception INTO gx_error.
      ROLLBACK WORK.
      WRITE: / 'ERROR:', gx_error->get_text( ).
  ENDTRY.
