CLASS zcl_agenda_dpc DEFINITION
  PUBLIC
  INHERITING FROM /iwbep/cl_mgw_push_abs_data
  CREATE PUBLIC .

  " Data provider of the OData service ZAGENDA_SRV (live agenda of an event), written by hand (no SEGW project).
  " Read only: the agenda is maintained in the tables (ZCL_AGENDA_DATA writes the default one, SM30 / SE16 to change).
  "   GET EventSet                         list of events
  "   GET EventSet('<id>')                 one event; 404 = not there
  "   GET EventSet('<id>')/Items           its agenda items in the order of Pos, also through $expand=Items
  "   GET ItemSet                          all items of all events
  "   GET ItemSet(EventId='<id>',Pos=3)    one item

  PUBLIC SECTION.

    METHODS /iwbep/if_mgw_appl_srv_runtime~get_entity    REDEFINITION.
    METHODS /iwbep/if_mgw_appl_srv_runtime~get_entityset REDEFINITION.

  PROTECTED SECTION.

    " abstract in the base class; the service has no subscriptions
    METHODS check_subscription_authority REDEFINITION.

  PRIVATE SECTION.

    METHODS key_of
      IMPORTING it_key_tab      TYPE /iwbep/t_mgw_name_value_pair
                iv_name         TYPE string
      RETURNING VALUE(rv_value) TYPE string.

    METHODS to_event
      IMPORTING is_event         TYPE zagenda_event
      RETURNING VALUE(rs_entity) TYPE zcl_agenda_mpc=>ts_event.

    METHODS to_item
      IMPORTING is_item          TYPE zagenda_item
      RETURNING VALUE(rs_entity) TYPE zcl_agenda_mpc=>ts_item.

    METHODS not_found
      IMPORTING iv_entity_name TYPE string
      RAISING   /iwbep/cx_mgw_busi_exception.
ENDCLASS.



CLASS zcl_agenda_dpc IMPLEMENTATION.


  METHOD check_subscription_authority.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_not_impl_exc
      EXPORTING
        textid = /iwbep/cx_mgw_not_impl_exc=>method_not_implemented
        method = 'CHECK_SUBSCRIPTION_AUTHORITY'.
  ENDMETHOD.


  METHOD key_of.
    READ TABLE it_key_tab INTO DATA(ls_key) WITH KEY name = iv_name.
    IF sy-subrc = 0.
      rv_value = ls_key-value.
    ENDIF.
  ENDMETHOD.


  METHOD not_found.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
      EXPORTING
        textid           = /iwbep/cx_mgw_busi_exception=>resource_not_found
        entity_type      = iv_entity_name
        http_status_code = '404'.
  ENDMETHOD.


  METHOD to_event.
    MOVE-CORRESPONDING is_event TO rs_entity.
    " day of the event as YYYY-MM-DD, time stamp as YYYYMMDDHHMMSS (UTC)
    CLEAR: rs_entity-event_date, rs_entity-changed_at.
    IF is_event-event_date IS NOT INITIAL.
      rs_entity-event_date = |{ is_event-event_date(4) }-{ is_event-event_date+4(2) }-{ is_event-event_date+6(2) }|.
    ENDIF.
    IF is_event-changed_at IS NOT INITIAL.
      rs_entity-changed_at = |{ is_event-changed_at }|.
    ENDIF.
  ENDMETHOD.


  METHOD to_item.
    MOVE-CORRESPONDING is_item TO rs_entity.
    rs_entity-pos = is_item-pos.
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~get_entity.
    DATA: ls_event TYPE zagenda_event,
          ls_item  TYPE zagenda_item.

    DATA(lv_event_id) = CONV zagenda_event-event_id( key_of( it_key_tab = it_key_tab iv_name = 'EventId' ) ).

    CASE iv_entity_set_name.

      WHEN 'EventSet'.
        SELECT SINGLE * FROM zagenda_event INTO @ls_event WHERE event_id = @lv_event_id.
        IF sy-subrc <> 0.
          not_found( iv_entity_name ).
        ENDIF.
        copy_data_to_ref( EXPORTING is_data = to_event( ls_event )
                          CHANGING  cr_data = er_entity ).

      WHEN 'ItemSet'.
        DATA(lv_pos) = CONV zagenda_item-pos( key_of( it_key_tab = it_key_tab iv_name = 'Pos' ) ).
        SELECT SINGLE * FROM zagenda_item INTO @ls_item WHERE event_id = @lv_event_id AND pos = @lv_pos.
        IF sy-subrc <> 0.
          not_found( iv_entity_name ).
        ENDIF.
        copy_data_to_ref( EXPORTING is_data = to_item( ls_item )
                          CHANGING  cr_data = er_entity ).

    ENDCASE.
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~get_entityset.
    DATA: lt_event TYPE zcl_agenda_mpc=>tt_event,
          lt_item  TYPE zcl_agenda_mpc=>tt_item.

    CASE iv_entity_set_name.

      WHEN 'EventSet'.
        SELECT * FROM zagenda_event INTO TABLE @DATA(lt_event_db) ORDER BY event_id.
        LOOP AT lt_event_db INTO DATA(ls_event_db).
          APPEND to_event( ls_event_db ) TO lt_event.
        ENDLOOP.
        /iwbep/cl_mgw_data_util=>paging( EXPORTING is_paging = is_paging CHANGING ct_data = lt_event ).   " $top / $skip
        copy_data_to_ref( EXPORTING is_data = lt_event
                          CHANGING  cr_data = er_entityset ).

      WHEN 'ItemSet'.
        " EventSet('<id>')/Items and $expand=Items: the key of the event comes with the request.
        " Without it (GET ItemSet) all items are returned.
        DATA(lv_event_id) = CONV zagenda_event-event_id( key_of( it_key_tab = it_key_tab iv_name = 'EventId' ) ).
        IF lv_event_id IS NOT INITIAL.
          SELECT * FROM zagenda_item INTO TABLE @DATA(lt_item_db)
            WHERE event_id = @lv_event_id
            ORDER BY PRIMARY KEY.
        ELSE.
          SELECT * FROM zagenda_item INTO TABLE @lt_item_db
            ORDER BY PRIMARY KEY.
        ENDIF.
        LOOP AT lt_item_db INTO DATA(ls_item_db).
          APPEND to_item( ls_item_db ) TO lt_item.
        ENDLOOP.
        /iwbep/cl_mgw_data_util=>paging( EXPORTING is_paging = is_paging CHANGING ct_data = lt_item ).    " $top / $skip
        copy_data_to_ref( EXPORTING is_data = lt_item
                          CHANGING  cr_data = er_entityset ).

    ENDCASE.
  ENDMETHOD.
ENDCLASS.
